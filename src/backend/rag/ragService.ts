import fs from 'fs';
import mammoth from 'mammoth';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import OpenAI from 'openai';
import { HistoryHandler } from '../db/historyHandler.js';
import {
    getOpenAIBaseUrl,
    getOpenAIProxyHeaders
} from '../apis/openai/openaiHelper.js';

interface RagScope {
    tenantId: string | null;
    serviceId: string;
}

async function resolveRagScope(
    projectId: string,
    serviceId?: string | null
): Promise<RagScope> {
    const tenantResolution =
        await HistoryHandler
            .resolveTenantIdByProjectId(
                projectId
            );

    if (!tenantResolution.resolved) {
        throw new Error(
            `[RAG][Tenant] No se pudo resolver ` +
            `tenant_id para project=${projectId}`
        );
    }

    if (
        !tenantResolution.globalScope &&
        !tenantResolution.tenantId
    ) {
        throw new Error(
            `[RAG][Tenant] Proyecto ${projectId} ` +
            `sin tenant propietario`
        );
    }

    const targetServiceId =
        String(
            serviceId ||
            HistoryHandler.SERVICE_IDENTIFIER ||
            'default_service'
        ).trim() || 'default_service';

    return {
        tenantId:
            tenantResolution.globalScope
                ? null
                : tenantResolution.tenantId,

        serviceId:
            targetServiceId
    };
}

async function getOpenAIClient(
    projectId?: string,
    serviceId?: string
) {
    let key =
        projectId
            ? await HistoryHandler.getConfig(
                'OPENAI_API_KEY',
                projectId,
                serviceId
            )
            : null;


    if (!key) {
        key =
            process.env
                .OPENAI_API_KEY ||
            null;
    }


    if (
        !key ||
        key.length <= 5
    ) {
        return null;
    }


    const baseURL =
        getOpenAIBaseUrl();

    const proxyHeaders =
        getOpenAIProxyHeaders(
            baseURL
        );


    return new OpenAI({
        apiKey: key,

        ...(baseURL
            ? {
                baseURL
            }
            : {}),

        ...(proxyHeaders
            ? {
                defaultHeaders:
                    proxyHeaders
            }
            : {})
    });
}

// Extrae el texto plano de archivos .docx, .pdf, .txt o .doc
export async function extractTextFromFile(filePath: string, fileName: string): Promise<string> {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    
    if (ext === 'docx' || ext === 'doc') {
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
    } else if (ext === 'pdf') {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        return data.text || '';
    } else {
        return fs.readFileSync(filePath, 'utf-8');
    }
}

// Fragmenta un texto largo en chunks de ~600 caracteres con 100 caracteres de solapamiento
export function chunkText(text: string, chunkSize = 600, overlap = 100): string[] {
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!cleanText) return [];

    const paragraphs = cleanText.split('\n\n');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
        const p = para.trim();
        if (!p) continue;

        if ((currentChunk + '\n\n' + p).length <= chunkSize) {
            currentChunk = currentChunk ? `${currentChunk}\n\n${p}` : p;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            if (p.length > chunkSize) {
                let start = 0;
                while (start < p.length) {
                    const end = Math.min(start + chunkSize, p.length);
                    chunks.push(p.slice(start, end));
                    start += (chunkSize - overlap);
                }
                currentChunk = '';
            } else {
                currentChunk = p;
            }
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

// Genera embeddings para un conjunto de textos usando OpenAI text-embedding-3-small
export async function generateEmbeddings(texts: string[], projectId?: string, serviceId?: string): Promise<number[][]> {
    const openai = await getOpenAIClient(projectId, serviceId);
    if (!openai || texts.length === 0) return [];

    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts
    });

    return response.data.map(item => item.embedding);
}

// Procesa un archivo descargado de Google Drive/Docs y lo almacena en Supabase knowledge_chunks
export async function indexDocumentForRAG(projectId: string, fileId: string, fileName: string, filePath: string, serviceId?: string): Promise<boolean> {
    const supabase = HistoryHandler.getSupabase();
    if (!supabase) {
        console.error('❌ Supabase no disponible para RAG.');
        return false;
    }

    try {
        const scope =
            await resolveRagScope(
                projectId,
                serviceId
            );

        console.log(`🧠 [RAG] Indexando documento "${fileName}" (ID: ${fileId}) para proyecto ${projectId}...`);
        
        const rawText = await extractTextFromFile(filePath, fileName);
        if (!rawText || rawText.trim().length === 0) {
            console.warn(`⚠️ [RAG] Documento "${fileName}" no contiene texto extraíble.`);
            return false;
        }

        const chunks = chunkText(rawText);
        console.log(`📌 [RAG] Extraídos ${chunks.length} fragmentos de texto de "${fileName}".`);

        if (chunks.length === 0) return false;

        const embeddings = await generateEmbeddings(chunks, projectId, serviceId);
        if (embeddings.length !== chunks.length) {
            console.error('❌ Error generando embeddings para los chunks.');
            return false;
        }

        // Eliminar fragmentos anteriores del mismo fileId / projectId / serviceId (multi-tenant & multi-service check)
        let deleteQuery = supabase
            .from('knowledge_chunks')
            .delete()
            .eq('project_id', projectId)
            .eq('service_id', scope.serviceId)
            .eq('file_id', fileId);

        if (scope.tenantId) {
            deleteQuery =
                deleteQuery.eq(
                    'tenant_id',
                    scope.tenantId
                );
        } else {
            deleteQuery =
                deleteQuery.is(
                    'tenant_id',
                    null
                );
        }

        const {
            error: deleteError
        } = await deleteQuery;

        if (deleteError) {
            console.error(
                '[RAG] Error eliminando chunks anteriores:',
                deleteError.message
            );

            return false;
        }

        const rowsToInsert =
            chunks.map(
                (
                    content,
                    idx
                ) => ({
                    tenant_id:
                        scope.tenantId,

                    project_id:
                        projectId,

                    service_id:
                        scope.serviceId,

                    file_id:
                        fileId,

                    file_name:
                        fileName,

                    content,

                    chunk_index:
                        idx,

                    embedding:
                        JSON.stringify(
                            embeddings[idx]
                        )
                })
            );

        for (let i = 0; i < rowsToInsert.length; i += 50) {
            const batch = rowsToInsert.slice(i, i + 50);
            const { error: insErr } = await supabase.from('knowledge_chunks').insert(batch);
            if (insErr) {
                console.error(`❌ [RAG] Error insertando batch de chunks en Supabase:`, insErr.message);
                return false;
            }
        }

        console.log(`✅ [RAG] Documento "${fileName}" indexado exitosamente en Supabase (${chunks.length} fragmentos).`);
        return true;
    } catch (err: any) {
        console.error(`❌ [RAG] Error procesando documento "${fileName}":`, err?.message || err);
        return false;
    }
}

// Función de consulta RAG para ser llamada durante la conversación o via Tool
export async function searchKnowledgeBase(projectId: string, query: string, topK = 5, serviceId?: string | null): Promise<string> {
    const supabase = HistoryHandler.getSupabase();
    const openai = await getOpenAIClient(projectId, serviceId || undefined);
    if (!supabase || !openai || !query || !query.trim()) return '';

    try {
        const scope =
            await resolveRagScope(
                projectId,
                serviceId
            );

        const embRes = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: query
        });
        const queryEmbedding = embRes.data[0].embedding;

        const { data, error } = await supabase.rpc('match_knowledge_chunks', {
            p_tenant_id:
                scope.tenantId,

            p_project_id:
                projectId,

            p_service_id:
                scope.serviceId,

            query_embedding:
                JSON.stringify(
                    queryEmbedding
                ),

            match_threshold:
                0.2,

            match_count:
                topK
        });

        if (error) {
            console.error('❌ [RAG] Error ejecutando match_knowledge_chunks:', error.message);
            return '';
        }

        if (!data || data.length === 0) {
            return '';
        }

        const resultsText = data.map((item: any) => `[Fuente: ${item.file_name}]\n${item.content}`).join('\n\n---\n\n');
        return resultsText;
    } catch (err: any) {
        console.error('❌ [RAG] Error consultando base de conocimientos:', err?.message || err);
        return '';
    }
}
