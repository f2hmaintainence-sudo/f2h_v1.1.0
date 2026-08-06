import { Injectable, Logger } from '@nestjs/common';
import { IStorageService } from '../interfaces/storage.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageService implements IStorageService {
    private readonly logger = new Logger(LocalStorageService.name);
    // Using __dirname ensures it always resolves to backend/uploads regardless of where you start the app
    // __dirname in dist/shared/services is 3 levels deep from the backend root
    private readonly baseUploadPath = path.join(__dirname, '..', '..', '..', 'uploads');

    constructor() {}

    async uploadFile(fileBuffer: Buffer, filename: string, folder: string): Promise<string> {
        // e.g., /path/to/backend/uploads/products
        const targetFolder = path.join(this.baseUploadPath, folder);

        // Automatically create the folder (products, categories, etc.) if it doesn't exist
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        // Full path to save the physical file on disk
        const fullPath = path.join(targetFolder, filename);
        fs.writeFileSync(fullPath, fileBuffer);
        this.logger.log(`File saved locally: ${fullPath}`);

        const relativePath = path.join(folder, filename).replace(/\\/g, '/'); // Ensure forward slashes for URLs

        // Return the clean relative path for your database
        // e.g., "products/shoes-123.webp"
        return relativePath;
    }
}

