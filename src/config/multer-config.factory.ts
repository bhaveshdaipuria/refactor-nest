import { diskStorage } from "multer";
import mime from "mime-types";

interface MulterConfigOptions {
  destination: string;
  useOriginalName?: boolean;
  prefix?: string; // For parties/alliances (e.g., 'party' or 'allianceName')
}

export const createMulterConfig = (options: MulterConfigOptions) => {
  return {
    storage: diskStorage({
      destination: options.destination,
      filename: (req, file, cb) => {
        const ext = mime.extension(file.mimetype) || "file"; // Fallback if extension not found
        const timestamp = Date.now();

        let filename: string;

        if (options.useOriginalName || !options.prefix) {
          // For candidates or when prefix is missing: timestamp + extension
          filename = `${timestamp}.${ext}`;
        } else {
          // For parties/alliances: timestamp + prefix (from req.body) + extension
          const prefixValue = req.body[options.prefix] || "unknown";
          filename = `${timestamp}-${prefixValue}.${ext}`;
        }

        cb(null, filename);
      },
    }),
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
