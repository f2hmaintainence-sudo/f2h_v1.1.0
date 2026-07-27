import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface AppAssetItem {
  key: string;
  url: string;
  type: 'image' | 'video' | 'other';
  sizeBytes: number;
  updatedAt: number;
}

@Injectable()
export class AppAssetsService {
  private readonly logger = new Logger(AppAssetsService.name);
  private readonly assetsBasePath = path.join(process.cwd(), 'uploads', 'app_assets');

  async getAppAssets(): Promise<{ statusCode: number; message: string; data: { assets: AppAssetItem[] } }> {
    try {
      const assetsList: AppAssetItem[] = [];

      if (fs.existsSync(this.assetsBasePath)) {
        this.scanDirectory(this.assetsBasePath, '', assetsList);
      } else {
        this.logger.warn(`Assets directory path not found: ${this.assetsBasePath}`);
      }

      return {
        statusCode: 200,
        message: 'App assets retrieved successfully',
        data: {
          assets: assetsList,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to scan app assets: ${error?.message || error}`);
      return {
        statusCode: 500,
        message: 'Failed to retrieve app assets',
        data: {
          assets: [],
        },
      };
    }
  }

  private scanDirectory(dirPath: string, relativeSubDir: string, resultList: AppAssetItem[]) {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const subPath = relativeSubDir ? `${relativeSubDir}/${item.name}` : item.name;

      if (item.isDirectory()) {
        this.scanDirectory(fullPath, subPath, resultList);
      } else if (item.isFile()) {
        const stats = fs.statSync(fullPath);
        const ext = path.extname(item.name).toLowerCase();
        
        let type: 'image' | 'video' | 'other' = 'other';
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
          type = 'image';
        } else if (['.mp4', '.mov', '.m4v', '.webm', '.avi'].includes(ext)) {
          type = 'video';
        }

        // Key formatted as "assets/folder/file.ext" matching flutter app asset paths
        const key = `assets/${subPath}`;
        // URL formatted as static served path e.g. "/uploads/app_assets/images/splash_3.png"
        const url = `/uploads/app_assets/${subPath}`;

        resultList.push({
          key,
          url,
          type,
          sizeBytes: stats.size,
          updatedAt: Math.floor(stats.mtimeMs),
        });
      }
    }
  }
}
