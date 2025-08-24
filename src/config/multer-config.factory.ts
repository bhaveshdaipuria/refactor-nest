import { diskStorage, memoryStorage } from "multer";
import mime from "mime-types";

interface MulterConfigOptions {
  destination?: string;
  inMemory?: boolean;
  useOriginalName?: boolean;
  prefix?: string; // For parties/alliances (e.g., 'party' or 'allianceName')
}

export const createMulterConfig = (options: MulterConfigOptions) => {
  const storage = options.inMemory
    ? memoryStorage()
    : diskStorage({
        destination: options.destination,
        filename: (req, file, cb) => {
          const ext = mime.extension(file.mimetype) || "file"; // fallback
          const timestamp = Date.now();

          let filename: string;

          if (options.useOriginalName || !options.prefix) {
            filename = `${timestamp}.${ext}`;
          } else {
            const prefixValue = req.body[options.prefix] || "unknown";
            filename = `${timestamp}-${prefixValue}.${ext}`;
          }

          cb(null, filename);
        },
      });

  return {
    storage,
    fileFilter: (req, file, cb) => {
      const allowedMimes = ["image/jpeg", "image/png", "image/gif"];
      if (file.mimetype && allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type. Only images are allowed!"), false);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  };
};
