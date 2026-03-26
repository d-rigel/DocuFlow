// backend/config/database.ts
import path from 'path';

export default ({ env }: { env: any }) => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  const connections: Record<string, object> = {
    sqlite: {
      connection: {
        // process.cwd() is always the project root (where you run `npm run dev`)
        // regardless of whether the file is compiled to dist/ or run directly.
        filename: path.join(
          process.cwd(),
          env('DATABASE_FILENAME', '.tmp/data.db')
        ),
      },
      useNullAsDefault: true,
    },
    postgres: {
      connection: {
        host:     env('DATABASE_HOST', 'localhost'),
        port:     env.int('DATABASE_PORT', 5432),
        database: env('DATABASE_NAME', 'collabdoc'),
        user:     env('DATABASE_USERNAME', 'postgres'),
        password: env('DATABASE_PASSWORD', ''),
        ssl:
          env.bool('DATABASE_SSL', false) && {
            rejectUnauthorized: env.bool('DATABASE_SSL_SELF', false),
          },
      },
    },
  };

  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};



