import 'reflect-metadata';

import colors from 'colors';
import {
	t,
	Elysia,
	type AfterHandler,
	type Context,
	type ErrorHandler,
	type Handler,
	type HTTPMethod,
	type MaybeArray,
	type TSchema,
} from 'elysia';
import type { ElysiaWS } from 'elysia/ws';
import { swagger, type ElysiaSwaggerConfig } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';

//! TYPES
type IHttpException = { message: string; status: number };
type ClassLike = new (...args: any[]) => any;
type ModuleProps = { controllers: ClassLike[] };
type fc = (...args: any[]) => any;
type Origin = string | RegExp | ((request: Request) => boolean | undefined);
type ElysiaCreateOptions<T> = {
	cors?: boolean | CORSConfig;
	swagger?: boolean | ElysiaSwaggerConfig<T extends string ? T : string>;
	auth?: Handler;
	response?: AfterHandler;
	error?: ErrorHandler<any, any>;
	plugins?: ((app: Elysia)=>Elysia)[];
	beforeStart?: fc[];
};
type HttpMethods = 'get' | 'post' | 'put' | 'delete' | 'patch';
type HttpMethodMetadataSetterProps = {
	path: string;
	method: HttpMethods;
	handler: Handler;
	controllerClass: ClassLike;
};
type Metadata = {
	path: string;
	method: HttpMethods;
	handler: (...args: unknown[]) => unknown;
	bodySchema?: { schema?: TSchema; index: number };
	querySchema?: { schema?: TSchema; index: number };
	paramSlug?: { slug: string; index: number };
	rawContext?: { index: number };
	isPublic?: true;
	customDecorators: { handler: Handler; index: number }[];
};
type WS = ElysiaWS;
type CORSConfig = {
	aot?: boolean;
	origin?: Origin | boolean | Origin[];
	methods?: boolean | undefined | null | '' | '*' | MaybeArray<HTTPMethod | (string & {})>;
	allowedHeaders?: true | string | string[];
	exposeHeaders?: true | string | string[];
	credentials?: boolean;
	maxAge?: number;
	preflight?: boolean;
};
export type {
	ElysiaSwaggerConfig,
	Context,
	TSchema,
	ErrorHandler,
	AfterHandler,
	Handler,
	CORSConfig,
	WS,
};

//! LOGGER SERVICE
function createLogger(serviceName = 'ElysiaApplication') {
	function messageParser(message: unknown) {
		if (typeof message !== 'string') return JSON.stringify(message);
		return message;
	}

	function logToConsole(level: string, message: unknown) {
		let result = '';
		const currentDate = new Date();
		const time = `${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}`;
		const parsedMessage = messageParser(message);

		switch (level) {
			case 'log':
				result = `[${colors.green('LOG')}] ${colors.dim.yellow.bold.underline(
					time,
				)} [${colors.green(serviceName)}] ${parsedMessage}`;
				break;
			case 'error':
				result = `[${colors.red('ERR')}] ${colors.dim.yellow.bold.underline(
					time,
				)} [${colors.red(serviceName)}] ${parsedMessage}`;
				break;
			case 'info':
				result = `[${colors.yellow('INFO')}] ${colors.dim.yellow.bold.underline(
					time,
				)} [${colors.yellow(serviceName)}] ${parsedMessage}`;
				break;
		}
		console.log(result);
	}

	function log(message: unknown) {
		logToConsole('log', message);
	}
	function error(message: unknown) {
		logToConsole('error', message);
	}
	function debug(message: unknown) {
		logToConsole('info', message);
	}

	return { log, error, debug };
}

const singletonLogger = createLogger();

function LoggerService(serviceName?: string) {
	if (serviceName) {
		return createLogger(serviceName);
	}
	return singletonLogger;
}

LoggerService.log = singletonLogger.log;
LoggerService.error = singletonLogger.error;
LoggerService.debug = singletonLogger.debug;

//! CREATE DECORATOR
const createCustomParameterDecorator = (handler: Handler) => {
	return (target: any, propertyKey: string, parameterIndex: number) => {
		const customDecorators = Reflect.getMetadata('customDecorators', target[propertyKey]) || [];
		customDecorators.push({ handler, index: parameterIndex });
		Reflect.defineMetadata('customDecorators', customDecorators, target[propertyKey]);
	};
};

//! Elysia Factory
const ElysiaFactory = {
	create: async <T extends string>(
		module: ClassLike,
		options?: ElysiaCreateOptions<T>,
	): Promise<Elysia> => {
		const app = new Elysia();
		const logger = LoggerService('ElysiaFactory');
		logger.log('Starting elysia application');

		if (options?.beforeStart) {
			for (const eachBeforeStart of options.beforeStart) await eachBeforeStart();
		}

		// CORS SETTING
		if (options?.cors) {
			app.use(cors(typeof options.cors === 'object' ? options.cors : {}));
		}

		if(options?.plugins) options.plugins.forEach(app.use)
			
		// SWAGGER SETTING
		if (options?.swagger) {
			app.use(swagger(typeof options.swagger === 'object' ? options.swagger : {}));
		}

		if (options?.error) {
			app.onError(options.error);
		}

		const controllers: ClassLike[] | undefined = Reflect.getMetadata('controllers', module);
		if (!controllers) {
			console.error('Invalid class module');
			process.exit(-1);
		}

		let injectedAppWithControllers = app;
		for (const eachControllerClass of controllers) {
			const initializeController = Reflect.getMetadata('initialize', eachControllerClass);
			if (!initializeController) {
				console.error('Invalid class module');
				process.exit(-1);
			}

			injectedAppWithControllers = await initializeController(app, {
				auth: options?.auth,
				response: options?.response,
			});
		}

		return injectedAppWithControllers;
	},
};

//! DECORATORS
const ServicesMap = new Map<string, any>();
const nextTick = () => new Promise((resolve) => process.nextTick(resolve));
const httpMethodMetadataSetter = (props: HttpMethodMetadataSetterProps) => {
	const bodySchema = Reflect.getMetadata('body', props.handler);
	const paramSlug = Reflect.getMetadata('param', props.handler);
	const querySchema = Reflect.getMetadata('query', props.handler);
	const rawContext = Reflect.getMetadata('rawContext', props.handler);
	const customDecorators = Reflect.getMetadata('customDecorators', props.handler) || [];
	const isPublic = Reflect.getMetadata('public', props.handler);

	const { method, handler, controllerClass } = props;
	const metadata: Metadata[] = Reflect.getMetadata('metadata', controllerClass) || [];
	const path = props.path.startsWith('/') ? props.path : `/${props.path}`;
	metadata.push({
		path,
		method,
		bodySchema,
		paramSlug,
		querySchema,
		customDecorators,
		rawContext,
		isPublic,
		handler: handler as any,
	});
	Reflect.defineMetadata('metadata', metadata, controllerClass);
};

const Module = ({ controllers }: ModuleProps) => {
	return (target: ClassLike) => {
		Reflect.defineMetadata('controllers', controllers, target);
	};
};
const Controller = (prefix: string) => {
	if (!prefix.startsWith('/')) prefix = `/${prefix}`;

	return (target: ClassLike) => {
		async function initializeController(
			app: Elysia,
			options?: { auth?: Handler; response?: AfterHandler },
		): Promise<Elysia> {
			LoggerService('RoutesResolver').log(`${target.name} {${prefix}}`);

			await nextTick();
			const tag: string = Reflect.getMetadata('tag', target) ?? 'default';
			const beforeHandle = options?.auth || ((c: Context) => {});
			const afterHandle = options?.response || ((c: Context) => {});

			const services = (Reflect.getMetadata('design:paramtypes', target) || []).map(
				(EachService: ClassLike) => {
					const instance = ServicesMap.get(EachService.name);
					if (!instance) {
						console.error(`Injected service is undefined in ${target.name}`);
						console.error('Make sure injected service has @Service decorator');
						process.exit(-1);
					}
					return instance;
				},
			);

			const controller = new target(...services);
			const metadata: Metadata[] = Reflect.getMetadata('metadata', target) || [];
			for (const eachMetadata of metadata) {
				const getParameters = async (c: Context): Promise<any[]> => {
					const parameters = [] as any;
					if (eachMetadata.rawContext) {
						parameters[eachMetadata.rawContext.index] = c;
					}
					if (eachMetadata.bodySchema) {
						parameters[eachMetadata.bodySchema.index] = c.body;
					}
					if (eachMetadata.querySchema) {
						parameters[eachMetadata.querySchema.index] = c.query;
					}
					if (eachMetadata.paramSlug) {
						parameters[eachMetadata.paramSlug.index] = c.params?.[eachMetadata.paramSlug.slug];
					}

					if (eachMetadata.customDecorators) {
						for (const eachCustomDecorator of eachMetadata.customDecorators) {
							parameters[eachCustomDecorator.index] = await eachCustomDecorator.handler(c);
						}
					}

					return parameters;
				};
				const bondedHandler = eachMetadata.handler.bind(controller);
				const isGenerator = bondedHandler.constructor.name.includes('GeneratorFunction');
				const getHandler = () => {
					if (isGenerator) {
						return async function* (c: Context) {
							try {
								for await (const eachValue of bondedHandler(...(await getParameters(c))) as any[])
									yield eachValue;
							} catch (error: any) {
								yield error;
							}
						};
					}
					return async (c: Context) => bondedHandler(...(await getParameters(c)));
				};

				app.route(eachMetadata.method, prefix + eachMetadata.path, getHandler(), {
					afterHandle: isGenerator ? undefined : afterHandle,
					beforeHandle: eachMetadata.isPublic ? undefined : beforeHandle,
					config: {},
					tags: [tag],
					body: eachMetadata.bodySchema?.schema,
					query: eachMetadata.querySchema?.schema as any,
					detail:
						!options?.auth || eachMetadata.isPublic
							? { security: [] }
							: { security: [{ BearerAuth: [] }] },
				});

				LoggerService('RouterExplorer').log(
					`Mapped {${eachMetadata.path}, ${eachMetadata.method.toUpperCase()}} route`,
				);
			}

			return app;
		}

		Reflect.defineMetadata('initialize', initializeController, target);
	};
};
const Websocket = (path: string, options?: { public?: boolean }) => {
	return (target: ClassLike) => {
		const isPublic = !!options?.public;
		async function initializeController(
			app: Elysia,
			options?: { auth?: Handler; response?: AfterHandler },
		): Promise<Elysia> {
			LoggerService('WebsocketResolver').log(`${target.name} {${path}}`);
			await nextTick();
			const services = (Reflect.getMetadata('design:paramtypes', target) || []).map(
				(EachService: ClassLike) => {
					const instance = ServicesMap.get(EachService.name);
					if (!instance) {
						console.error(`Injected service is undefined in ${target.name}`);
						console.error('Make sure injected service has @Service decorator');
						process.exit(-1);
					}
					return instance;
				},
			);

			const metadata = Reflect.getMetadata('metadata', target) || {};
			const controller = new target(...services);
			const open = metadata.open ? metadata.open.bind(controller) : undefined;
			const close = metadata.close ? metadata.close.bind(controller) : undefined;
			const message = metadata.message ? metadata.message.bind(controller) : undefined;

			app.ws(path, {
				beforeHandle: !isPublic && (options?.auth as any),
				open,
				close,
				message,
				body: metadata.body,
			});

			return app;
		}

		Reflect.defineMetadata('initialize', initializeController, target);
	};
};

const Open = (): MethodDecorator => {
	return (target, _, desc: PropertyDescriptor) => {
		const metadata = Reflect.getMetadata('metadata', target.constructor) ?? {};
		metadata.open = desc.value;
		Reflect.defineMetadata('metadata', metadata, target.constructor);
	};
};

const Close = (): MethodDecorator => {
	return (target, _, desc: PropertyDescriptor) => {
		const metadata = Reflect.getMetadata('metadata', target.constructor) ?? {};
		metadata.close = desc.value;
		Reflect.defineMetadata('metadata', metadata, target.constructor);
	};
};

const Message = (schema?: TSchema): MethodDecorator => {
	return (target, _, desc: PropertyDescriptor) => {
		const metadata = Reflect.getMetadata('metadata', target.constructor) ?? {};
		metadata.message = desc.value;
		metadata.body = schema;
		Reflect.defineMetadata('metadata', metadata, target.constructor);
	};
};

const ApiTag = (tag: string) => {
	return (target: ClassLike) => {
		Reflect.defineMetadata('tag', tag, target);
	};
};
const Get = (path = '/'): MethodDecorator => {
	return (target, _, desc: PropertyDescriptor) => {
		process.nextTick(() =>
			httpMethodMetadataSetter({
				controllerClass: target.constructor as ClassLike,
				path,
				method: 'get',
				handler: desc.value,
			}),
		);
	};
};
const Post = (path = '/'): MethodDecorator => {
	return (target, _, desc: PropertyDescriptor) => {
		process.nextTick(() =>
			httpMethodMetadataSetter({
				controllerClass: target.constructor as ClassLike,
				path,
				method: 'post',
				handler: desc.value,
			}),
		);
	};
};
const Put = (path = '/'): MethodDecorator => {
	return (target, _, desc: PropertyDescriptor) => {
		process.nextTick(() =>
			httpMethodMetadataSetter({
				controllerClass: target.constructor as ClassLike,
				path,
				method: 'put',
				handler: desc.value,
			}),
		);
	};
};
const Delete = (path = '/'): MethodDecorator => {
	return (target, _, desc: PropertyDescriptor) => {
		process.nextTick(() =>
			httpMethodMetadataSetter({
				controllerClass: target.constructor as ClassLike,
				path,
				method: 'delete',
				handler: desc.value,
			}),
		);
	};
};
const Patch = (path = '/'): MethodDecorator => {
	return (target, propertyKey, desc: PropertyDescriptor) => {
		process.nextTick(() =>
			httpMethodMetadataSetter({
				controllerClass: target.constructor as ClassLike,
				path,
				method: 'patch',
				handler: desc.value,
			}),
		);
	};
};

const Public = (): MethodDecorator => {
	return (_, __, desc: PropertyDescriptor) => {
		Reflect.defineMetadata('public', true, desc.value);
	};
};

const RawContext = () => {
	return (target: any, propertyKey: string, parameterIndex: number) => {
		Reflect.defineMetadata('rawContext', { index: parameterIndex }, target[propertyKey]);
	};
};

const Body = (schema?: TSchema) => {
	return (target: any, propertyKey: string, parameterIndex: number) => {
		Reflect.defineMetadata('body', { schema, index: parameterIndex }, target[propertyKey]);
	};
};

const Param = (slug: string) => {
	return (target: any, propertyKey: string, parameterIndex: number) => {
		Reflect.defineMetadata('param', { slug, index: parameterIndex }, target[propertyKey]);
	};
};

const Query = (schema?: TSchema) => {
	return (target: any, propertyKey: string, parameterIndex: number) => {
		Reflect.defineMetadata('query', { schema, index: parameterIndex }, target[propertyKey]);
	};
};

const Service = () => {
	return (target: ClassLike) => {
		const classname = target.name;
		if (ServicesMap.has(classname)) {
			console.error(`Service ${classname} already exists`);
			process.exit(-1);
		}
		ServicesMap.set(classname, new target());
	};
};

const HttpStatus = {
	// Informational Responses
	CONTINUE: 100,
	SWITCHING_PROTOCOLS: 101,
	PROCESSING: 102,
	CONTINUE_MESSAGE: 'Continue',
	SWITCHING_PROTOCOLS_MESSAGE: 'Switching Protocols',
	PROCESSING_MESSAGE: 'Processing',

	// Success Responses
	OK: 200,
	CREATED: 201,
	ACCEPTED: 202,
	NON_AUTHORITATIVE_INFORMATION: 203,
	NO_CONTENT: 204,
	RESET_CONTENT: 205,
	PARTIAL_CONTENT: 206,
	MULTI_STATUS: 207,
	ALREADY_REPORTED: 208,
	IM_USED: 226,
	OK_MESSAGE: 'OK',
	CREATED_MESSAGE: 'Created',
	ACCEPTED_MESSAGE: 'Accepted',
	NON_AUTHORITATIVE_INFORMATION_MESSAGE: 'Non-Authoritative Information',
	NO_CONTENT_MESSAGE: 'No Content',
	RESET_CONTENT_MESSAGE: 'Reset Content',
	PARTIAL_CONTENT_MESSAGE: 'Partial Content',
	MULTI_STATUS_MESSAGE: 'Multi-Status',
	ALREADY_REPORTED_MESSAGE: 'Already Reported',
	IM_USED_MESSAGE: 'IM Used',

	// Redirection Messages
	MULTIPLE_CHOICES: 300,
	MOVED_PERMANENTLY: 301,
	FOUND: 302,
	SEE_OTHER: 303,
	NOT_MODIFIED: 304,
	USE_PROXY: 305,
	TEMPORARY_REDIRECT: 307,
	PERMANENT_REDIRECT: 308,
	MULTIPLE_CHOICES_MESSAGE: 'Multiple Choices',
	MOVED_PERMANENTLY_MESSAGE: 'Moved Permanently',
	FOUND_MESSAGE: 'Found',
	SEE_OTHER_MESSAGE: 'See Other',
	NOT_MODIFIED_MESSAGE: 'Not Modified',
	USE_PROXY_MESSAGE: 'Use Proxy',
	TEMPORARY_REDIRECT_MESSAGE: 'Temporary Redirect',
	PERMANENT_REDIRECT_MESSAGE: 'Permanent Redirect',

	// Client Error Responses
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	PAYMENT_REQUIRED: 402,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	NOT_ACCEPTABLE: 406,
	PROXY_AUTHENTICATION_REQUIRED: 407,
	REQUEST_TIMEOUT: 408,
	CONFLICT: 409,
	GONE: 410,
	LENGTH_REQUIRED: 411,
	PRECONDITION_FAILED: 412,
	PAYLOAD_TOO_LARGE: 413,
	URI_TOO_LONG: 414,
	UNSUPPORTED_MEDIA_TYPE: 415,
	RANGE_NOT_SATISFIABLE: 416,
	EXPECTATION_FAILED: 417,
	I_AM_A_TEAPOT: 418,
	MISDIRECTED_REQUEST: 421,
	UNPROCESSABLE_ENTITY: 422,
	LOCKED: 423,
	FAILED_DEPENDENCY: 424,
	TOO_EARLY: 425,
	UPGRADE_REQUIRED: 426,
	PRECONDITION_REQUIRED: 428,
	TOO_MANY_REQUESTS: 429,
	REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
	UNAVAILABLE_FOR_LEGAL_REASONS: 451,
	BAD_REQUEST_MESSAGE: 'Bad Request',
	UNAUTHORIZED_MESSAGE: 'Unauthorized',
	PAYMENT_REQUIRED_MESSAGE: 'Payment Required',
	FORBIDDEN_MESSAGE: 'Forbidden',
	NOT_FOUND_MESSAGE: 'Not Found',
	METHOD_NOT_ALLOWED_MESSAGE: 'Method Not Allowed',
	NOT_ACCEPTABLE_MESSAGE: 'Not Acceptable',
	PROXY_AUTHENTICATION_REQUIRED_MESSAGE: 'Proxy Authentication Required',
	REQUEST_TIMEOUT_MESSAGE: 'Request Timeout',
	CONFLICT_MESSAGE: 'Conflict',
	GONE_MESSAGE: 'Gone',
	LENGTH_REQUIRED_MESSAGE: 'Length Required',
	PRECONDITION_FAILED_MESSAGE: 'Precondition Failed',
	PAYLOAD_TOO_LARGE_MESSAGE: 'Payload Too Large',
	URI_TOO_LONG_MESSAGE: 'URI Too Long',
	UNSUPPORTED_MEDIA_TYPE_MESSAGE: 'Unsupported Media Type',
	RANGE_NOT_SATISFIABLE_MESSAGE: 'Range Not Satisfiable',
	EXPECTATION_FAILED_MESSAGE: 'Expectation Failed',
	I_AM_A_TEAPOT_MESSAGE: "I'm a teapot",
	MISDIRECTED_REQUEST_MESSAGE: 'Misdirected Request',
	UNPROCESSABLE_ENTITY_MESSAGE: 'Unprocessable Entity',
	LOCKED_MESSAGE: 'Locked',
	FAILED_DEPENDENCY_MESSAGE: 'Failed Dependency',
	TOO_EARLY_MESSAGE: 'Too Early',
	UPGRADE_REQUIRED_MESSAGE: 'Upgrade Required',
	PRECONDITION_REQUIRED_MESSAGE: 'Precondition Required',
	TOO_MANY_REQUESTS_MESSAGE: 'Too Many Requests',
	REQUEST_HEADER_FIELDS_TOO_LARGE_MESSAGE: 'Request Header Fields Too Large',
	UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE: 'Unavailable For Legal Reasons',

	// Server Error Responses
	INTERNAL_SERVER_ERROR: 500,
	NOT_IMPLEMENTED: 501,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504,
	HTTP_VERSION_NOT_SUPPORTED: 505,
	VARIANT_ALSO_NEGOTIATES: 506,
	INSUFFICIENT_STORAGE: 507,
	LOOP_DETECTED: 508,
	NOT_EXTENDED: 510,
	NETWORK_AUTHENTICATION_REQUIRED: 511,
	INTERNAL_SERVER_ERROR_MESSAGE: 'Internal Server Error',
	NOT_IMPLEMENTED_MESSAGE: 'Not Implemented',
	BAD_GATEWAY_MESSAGE: 'Bad Gateway',
	SERVICE_UNAVAILABLE_MESSAGE: 'Service Unavailable',
	GATEWAY_TIMEOUT_MESSAGE: 'Gateway Timeout',
	HTTP_VERSION_NOT_SUPPORTED_MESSAGE: 'HTTP Version Not Supported',
	VARIANT_ALSO_NEGOTIATES_MESSAGE: 'Variant Also Negotiates',
	INSUFFICIENT_STORAGE_MESSAGE: 'Insufficient Storage',
	LOOP_DETECTED_MESSAGE: 'Loop Detected',
	NOT_EXTENDED_MESSAGE: 'Not Extended',
	NETWORK_AUTHENTICATION_REQUIRED_MESSAGE: 'Network Authentication Required',
};

export class HttpException extends Error implements IHttpException {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = this.constructor.name;
		this.status = status || HttpStatus.INTERNAL_SERVER_ERROR;
		Error.captureStackTrace(this, this.constructor);
	}
}

export class ForbiddenException extends HttpException {
	constructor(message: string = HttpStatus.FORBIDDEN_MESSAGE) {
		super(message, HttpStatus.FORBIDDEN);
	}
}

export class BadRequestException extends HttpException {
	constructor(message: string = HttpStatus.BAD_REQUEST_MESSAGE) {
		super(message, HttpStatus.BAD_REQUEST);
	}
}

export class UnauthorizedException extends HttpException {
	constructor(message: string = HttpStatus.UNAUTHORIZED_MESSAGE) {
		super(message, HttpStatus.UNAUTHORIZED);
	}
}

export class NotFoundException extends HttpException {
	constructor(message: string = HttpStatus.NOT_FOUND_MESSAGE) {
		super(message, HttpStatus.NOT_FOUND);
	}
}

export class MethodNotAllowedException extends HttpException {
	constructor(message: string = HttpStatus.METHOD_NOT_ALLOWED_MESSAGE) {
		super(message, HttpStatus.METHOD_NOT_ALLOWED);
	}
}

//! EXPORTS
export * from 'elysia';
export {
	t,
	HttpStatus,
	LoggerService,
	createCustomParameterDecorator,
	Module,
	Controller,
	ApiTag,
	Websocket,
	Open,
	Close,
	Message,
	Get,
	Post,
	Put,
	Delete,
	Patch,
	Public,
	RawContext,
	Body,
	Param,
	Query,
	Service,
	ElysiaFactory,
};
