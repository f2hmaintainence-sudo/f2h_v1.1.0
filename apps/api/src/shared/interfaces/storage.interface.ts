export interface IStorageService {
    /**
     * Saves a file and returns the path/URL to be saved in the DB
     */
    uploadFile(fileBuffer: Buffer, filename: string, folder: string): Promise<string>;
}
