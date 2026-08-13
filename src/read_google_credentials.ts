import "dotenv/config";

console.log("GOOGLE_CLIENT_EMAIL:", process.env.GOOGLE_CLIENT_EMAIL);
console.log("GOOGLE_PRIVATE_KEY length:", process.env.GOOGLE_PRIVATE_KEY?.length);
console.log("GOOGLE_PRIVATE_KEY starts with:", process.env.GOOGLE_PRIVATE_KEY?.substring(0, 30));
