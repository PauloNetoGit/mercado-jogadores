import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { jsonObjectBody } from './common/json-object-body.middleware';
import { requestLogger } from './common/request-logger.middleware';

/** Configuração compartilhada entre a execução real e os testes de ponta a ponta. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');

  app.use(requestLogger);
  app.use(jsonObjectBody);

  // Campos que não pertencem ao endpoint são ignorados, sem erro (V7).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    exposedHeaders: ['Location', 'Content-Disposition'],
  });
}

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Passe: API do mercado de jogadores')
    .setDescription(
      'Jogadores, clubes, compra e venda com contrato, histórico de transações, escalação, partidas e classificação.',
    )
    .setVersion('1.0.0')
    .build();

  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );
}
