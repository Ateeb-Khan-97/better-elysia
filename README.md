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

Add your controllers here

```
import { Module } from 'better-elysia';
import { AuthController } from './modules/auth/auth.controller';
import { ChatWebsocket } from './modules/chat/chat.websocket';

// ADD YOUR CONTROLLERS HERE
@Module({ controllers: [AuthController, ChatWebsocket] })
export class AppModule {}

```

# Controller

**Example:**

```
import { ApiTag, Controller, Get, Post } from 'better-elysia';

@ApiTag('Auth')
@Controller('/api/auth')
export class AuthController {
	@Post('/sign-in')
	async signinHandler() {}
}
```

To use validation you can use validator provided by elysia, here's how i do this

Create a schema file `auth.schema.ts`

**Example:**

```
import { t } from 'better-elysia';

export namespace AuthSchema {
	export const Signin = t.Object({
		email: t.String({ format: 'email' }),
		password: t.String({ minLength: 8, maxLength: 32 }),
	});
	export type Signin = typeof Signin.static;
}
```

and use it in the controller

**Example:**

```
import { ApiTag, Body, Controller, Post } from 'better-elysia';
import { AuthSchema } from './auth.schema';

@ApiTag('Auth')
@Controller('/api/auth')
export class AuthController {
	@Post('/sign-in')
	async signinHandler(@Body(AuthSchema.Signin) body: AuthSchema.Signin) {}
}
```

Same works for query too

**Example:**

```
import { ApiTag, Controller, Post, Query } from 'better-elysia';
import { AuthSchema } from './auth.schema';

@ApiTag('Auth')
@Controller('/api/auth')
export class AuthController {
	@Post('/sign-in')
	async signinHandler(@Query(AuthSchema.Signin) query: AuthSchema.Signin) {}
}
```

For params

**Example:**

```
import { ApiTag, Controller, Get, Param } from 'better-elysia';

@ApiTag('Auth')
@Controller('/api/auth')
export class AuthController {
	@Get('/:id')
	async getById(@Param('id') id: string) {
		console.log(id);
	}
}
```

# Streaming

For streaming use `GeneratorFunctions`

**Example:**

This will stream numbers from 0 to 9999

```
import { ApiTag, Controller, Get } from 'better-elysia';

@ApiTag('Auth')
@Controller('/api/auth')
export class AuthController {
	@Get('/stream-test')
	async *streamHandler() {
		for (let i = 0; i < 10000; i++) yield i;
	}
}
```

# Public

To make endpoint public and not use auth middleware passed in `ElysiaFactory` use @Public Decorator

**Example:**

```
import { ApiTag, Controller, Get, Public } from 'better-elysia';

@ApiTag('Auth')
@Controller('/api/auth')
export class AuthController {
	@Public()
	@Get()
	async publicEndpoint() {}
}
```

# Websocket

For implementation of websocket use @Websocket decorator

**Example:**

```
import { Close, Message, Open, t, Websocket, LoggerService, type WS } from 'better-elysia';

const MessageSchema = t.Object({
	content: t.String(),
});
type MessageSchema = typeof MessageSchema.static;

// TO MAKE WEBSOCKET PUBLIC USE @Websocket('/chat', { public: true })
@Websocket('/chat', { public: false })
export class ChatWebsocket {
    private readonly logger = LoggerService(ChatWebsocket.name);

	@Open()
	async openHandler(ws: WS) {
		// FUNCTION WILL RUN AFTER CONNECTING TO Websocket
	}

	@Close()
	async closeHandler(ws: WS) {
		// FUNCTION WILL RUN AFTER DISCONNECTING FROM Websocket
	}

	@Message(MessageSchema)
	async messageHandler(ws: WS, msg: MessageSchema) {
		// FUNCTION WILL RUN AFTER RECEIVING A MESSAGE
	}
}
```

# Service

For making services use @Service decorator
what it will do is make a singleton of the class and inject the singleton to all the @Controller and @Websocket

**Example:**

```
import { Service } from 'better-elysia';

@Service()
export class UserService {
	async findOneById(id: number) {
		return { id, name: 'Ateeb' };
	}
}
```

Now use it anywhere

**Example:**

```
import { ApiTag, Controller, Get } from 'better-elysia';
import { UserService } from './auth.service';

@ApiTag('Auth')
@Controller('/api/auth')
export class AuthController {
	constructor(private readonly userService: UserService) {}

    @Get('/me')
	async me() {
		return this.userService.findOneById(1);
	}
}
```

```
import { Close, Message, Open, t, Websocket, type WS } from 'better-elysia';
import { UserService } from '../auth/auth.service';

const MessageSchema = t.Object({
	content: t.String(),
});
type MessageSchema = typeof MessageSchema.static;

// TO MAKE WEBSOCKET PUBLIC USE @Websocket('/chat', { public: true })
@Websocket('/chat', { public: false })
export class ChatWebsocket {
	constructor(private readonly userService: UserService) {}

	@Open()
	async openHandler(ws: WS) {
		// FUNCTION WILL RUN AFTER CONNECTING TO Websocket
	}

	@Close()
	async closeHandler(ws: WS) {
		// FUNCTION WILL RUN AFTER DISCONNECTING FROM Websocket
	}

	@Message(MessageSchema)
	async messageHandler(ws: WS, msg: MessageSchema) {
		// FUNCTION WILL RUN AFTER RECEIVING A MESSAGE
	}
}
```

# Custom Decorator

To make your own custom parameter decorator use `createCustomParameterDecorator` function

**UseCase and Example:**

```
import { createCustomParameterDecorator, type Handler } from 'better-elysia';

export const AuthHandler: Handler = (c) => {
	// ADD YOUR AUTH LOGIC HERE
	(c.store as any).user = 1;
};

export const CurrentUser = () => {
	return createCustomParameterDecorator((c) => (c.store as any).user);
};
```

Add you `AuthHandler` in `ElysiaFactory`

**Example:**

```
import { ElysiaFactory, LoggerService } from 'better-elysia';
import { AppModule } from './app.module';
import { AuthHandler } from './middleware/auth.middleware';

async function bootstrap() {
	const app = await ElysiaFactory.create(AppModule, {
		auth: AuthHandler,
	});

	app.listen(5000, () => LoggerService.log('Application started at http://localhost:5000'));
}

bootstrap();
```

and the custom decorator you just create in Controller

**Example:**

```
import { ApiTag, Controller, Get } from 'better-elysia';
import { UserService } from './auth.service';
import { CurrentUser } from '../../middleware/auth.middleware';

@ApiTag('Auth')
@Controller('/api/auth')
export class AuthController {
	constructor(private readonly userService: UserService) {}

	@Get('/me')
	async me(@CurrentUser() userId: number) {
		return this.userService.findOneById(userId);
	}
}
```

# License

This project is licensed under the MIT License
