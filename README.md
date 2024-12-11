# Better Elysia

Better Elysia is an npm package that enhances the already fun and lightweight Elysia.js framework by introducing powerful decorators to simplify and streamline your development process. With this package, you can enjoy a more expressive and organized way to define routes, middleware, and more, making your Elysia.js experience even more enjoyable and productive.

## Installation

```bash
npm install better-elysia
```

IMPORTANT!

Add these in your `tsconfig.json`

```
"emitDecoratorMetadata": true,
"experimentalDecorators": true,
```

To bootstrap the application

# Bootstrap

```
import { ElysiaFactory, LoggerService } from 'better-elysia';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await ElysiaFactory.create(AppModule, {
		auth: () => {}, // ADD YOUR AUTH HANDLER HERE,
		response: () => {}, // ADD YOUR RESPONSE HANDLER HERE
		error: () => {}, // ADD YOUR ERROR HANDLER HERE
		cors: { origin: '*' }, // ADD YOUR CORS CONFIG HERE (it's optional if not passed application won't use cors)
		swagger: { provider: 'swagger-ui' }, // ADD YOUR SWAGGER CONFIG HERE (it's optional if not passed application won't use swagger)
		beforeStart: [], // ADD all functions you want to run before application starts (example connecting to database)
	});

	app.listen(5000, () => LoggerService.log('Application started at http://localhost:5000'));
}

bootstrap();
```

# AppModule

```
import { Module } from 'better-elysia';

// ADD YOUR CONTROLLERS HERE
@Module({ controllers: [] })
export class AppModule {}

```

Add your controllers here

# License

This project is licensed under the MIT License
