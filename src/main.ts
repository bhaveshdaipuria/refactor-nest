import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session'
import {NestExpressApplication} from '@nestjs/platform-express'
import {join} from 'path'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Enable CORS
  app.enableCors();

  // Set global prefix

  app.use(
    session({
      secret: 'sdfksdhvfklufhvylksduyvfsdfff',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: false, // Usually recommended to be true
        sameSite: 'lax',
      },
    })
  )

  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Set views directory
  app.setBaseViewsDir(join(__dirname, '..', 'views'));

  // Set view engine
  app.setViewEngine('ejs');
  await app.listen(process.env.PORT ?? 9000);
}
bootstrap();
