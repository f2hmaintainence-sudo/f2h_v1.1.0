declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
    Backend_Port?: string;
    REDIS_PREFIX?: string;
    FRONTEND_URL?: string;
    JWT_SECRET?: string;
    SESSION_SECRET?: string;
    FAST2SMS_API_KEY?: string;
    FAST2SMS_ENDPOINT?: string;
    FAST2SMS_ROUTE?: string;
    APP_URL?: string;
    [key: string]: string | undefined;
  }
}

declare namespace globalThis {
  var process: NodeJS.Process;
}

declare module '@nestjs/config' {
  export class ConfigModule {
    static forRoot(...args: any[]): any;
  }

  export class ConfigService {
    get<T = any>(key: string, defaultValue?: T): T;
  }
}
