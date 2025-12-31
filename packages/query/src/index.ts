import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyStructuredResultV2,
	Context,
} from "aws-lambda";
import type { Request } from "openapi-backend";
import { withMiddlewares } from "./middleware";
import { createAPI } from "./openapi";
// import definition from "./openapi/definition.json";
// import { executeCode } from "./sandbox";
import { logger } from "@analytics/common/powertools";
import { handleErrors } from "./openapi/utils";

const headers = {
	"content-type": "application/json",
	"access-control-allow-origin": "*",
};

const api = createAPI('definition' as unknown as string);

api.register({
	getOverview: async (...params) =>
    (await import('./query')).getOverview(...params),
});

api.init();

export const apiHandler = async (
	event: APIGatewayProxyEventV2,
	context: Context,
): Promise<APIGatewayProxyStructuredResultV2> => {
	if (event.rawPath === "/openapi.json") {
		return {
			statusCode: 200,
			body: JSON.stringify('definition'),
			headers,
		};
	}

	logger.debug("API Handler", { event, context });

	return await api
		.handleRequest(
			{
				method: event.requestContext.http.method,
				path: event.rawPath,
				query: event.rawQueryString,
				body: event.body,
				headers: event.headers as Request["headers"],
			},
			event,
			context,
		)
		.catch(handleErrors);
};

export const handler = withMiddlewares(apiHandler);
