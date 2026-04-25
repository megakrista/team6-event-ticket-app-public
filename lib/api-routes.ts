export const API_ROUTES = {
  venues: "/api/venues",
  venueById: (id: string) => `/api/venues/${id}`,
  events: "/api/events",
  eventById: (id: string) => `/api/events/${id}`,
  signup: "/api/auth/signup",
  login: "/api/auth/login",
  googleAuthStart: "/api/auth/google/start",
  userMe: "/api/users/me",
  users: "/api/users",
  userById: (id: string) => `/api/users/${id}`,
} as const;
