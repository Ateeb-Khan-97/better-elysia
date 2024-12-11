# Better Elysia

Better Elysia is an npm package that enhances the already fun and lightweight Elysia.js framework by introducing powerful decorators to simplify and streamline your development process. With this package, you can enjoy a more expressive and organized way to define routes, middleware, and more, making your Elysia.js experience even more enjoyable and productive.

## Installation

```bash
npm install better-elysia
```

To bootstrap the application

```
import { ElysiaFactory, LoggerService } from 'better-elysia';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await ElysiaFactory.create(AppModule);

	app.listen(5000, () => LoggerService.log('Application started at http://localhost:5000'));
}

bootstrap();
```

# License

This project is licensed under the MIT License
