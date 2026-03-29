export const API_ROUTES = {
  venues: "/api/venues",
  events: "/api/events",
  eventById: (id: string) => `/api/events/${id}`,
  signup: "/api/auth/signup",
  login: "/api/auth/login",
} as const;
