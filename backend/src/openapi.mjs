const ref = name => ({ $ref: `#/components/schemas/${name}` });
const json = schema => ({ 'application/json': { schema } });
const response = (description, schema = { type: 'object' }) => ({ description, content: json(schema) });
const post = (summary, schema, result = { type: 'object' }, status = '200') => ({ summary, requestBody: { required: true, content: json(schema) }, responses: { [status]: response('Success', result), '400': response('Malformed JSON', ref('Error')), '413': response('Body exceeds 64 KiB', ref('Error')), '415': response('JSON content type required', ref('Error')), '422': response('Validation failed', ref('Error')) } });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const numeric = (minimum, maximum) => ({ type: 'number', minimum, maximum });
const stateBody = properties => obj({ state: ref('FlightState'), ...properties });

export const openapi = {
  openapi: '3.1.0',
  info: { title: 'Nextgen eVTOL API', version: '0.1.0', description: 'Stateless concept-scene and flight-domain service. Simulation can run locally in the browser; no accounts, cloud saves or real navigation. JSON aliases match the GitHub Pages export.' },
  servers: [{ url: '/' }],
  paths: {
    '/healthz': { get: { summary: 'Service health and concept readiness', responses: { '200': response('Healthy') } } },
    ...Object.fromEntries(['manifest', 'scene', 'routes', 'aircraft', 'landmarks', 'sources'].map(path => [`/api/v1/${path}`, { get: { summary: `Read ${path}`, responses: { '200': response('Versioned concept content', ['routes', 'aircraft', 'landmarks', 'sources'].includes(path) ? { type: 'array', items: { type: 'object' } } : { type: 'object' }), '304': { description: 'ETag unchanged' } } } }])),
    '/api/v1/routes/{routeId}': { get: { summary: 'Read a route', parameters: [{ name: 'routeId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': response('Route'), '404': response('Unknown route', ref('Error')) } } },
    '/api/v1/flights': { post: post('Create a local flight state; no server persistence', obj({ routeId: { type: 'string' }, mode: ref('Mode') }, ['routeId']), obj({ state: ref('FlightState'), persistence: { const: 'client-local' } }), '201') },
    '/api/v1/flights/mode': { post: post('Transfer control without changing position or velocity', stateBody({ mode: ref('Mode') }), obj({ state: ref('FlightState') })) },
    '/api/v1/flights/step': { post: post('Advance a bounded simulation step (browser-local runtime recommended)', stateBody({ deltaSeconds: numeric(0, 0.25), input: ref('Input') }), obj({ state: ref('FlightState') })) },
    '/api/v1/flights/preview': { post: post('Sample the concept route for preview', obj({ routeId: { type: 'string' }, intervalSeconds: numeric(0.25, 30) }, ['routeId']), obj({ contentStatus: { const: 'concept' }, samples: { type: 'array', items: { type: 'object' } } })) },
    '/api/v1/checkpoints/validate': { post: post('Validate a local save and return a paused state', obj({ schemaVersion: { const: 1 }, savedAt: { type: 'string', format: 'date-time' }, state: ref('FlightState') })) }
  },
  components: { schemas: {
    Mode: { type: 'string', enum: ['passenger', 'pilot'] },
    Vector: obj({ x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }),
    Input: obj({ throttle: numeric(-1, 1), turn: numeric(-1, 1), climb: numeric(-1, 1), hover: { type: 'boolean' } }, []),
    FlightState: obj({ schemaVersion: { const: 1 }, sceneId: { type: 'string' }, sceneVersion: { type: 'string' }, routeId: { type: 'string' }, routeVersion: { type: 'string' },
      position: ref('Vector'), velocity: ref('Vector'), heading: numeric(-Math.PI, Math.PI), routeSeconds: numeric(0, 3600), elapsedSeconds: numeric(0, 86400),
      phase: { enum: ['takeoff', 'transition', 'cruise', 'approach', 'landing', 'arrived'] }, mode: ref('Mode'), control: { enum: ['route', 'rejoining', 'holding', 'pilot'] }, status: { enum: ['flying', 'arrived'] },
      pauseReason: { enum: [null, 'user', 'focus', 'resources'] }, camera: { enum: ['window', 'forward', 'chase'] },
      rejoin: { anyOf: [{ type: 'null' }, obj({ target: ref('Vector'), targetSeconds: numeric(0, 3600) })] }, notice: { type: ['string', 'null'] }, visitedLandmarks: { type: 'array', items: { type: 'string' }, uniqueItems: true } }),
    Error: obj({ error: obj({ code: { type: 'string' }, message: { type: 'string' }, field: { type: 'string' } }, ['code', 'message']) })
  } }
};
