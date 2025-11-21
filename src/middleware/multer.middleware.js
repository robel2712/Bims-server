import multer from "multer";


export const upload = multer({
  storage: multer.memoryStorage(), // use memory storage so we can push to Blob
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});