export type SignupBody = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
};

export type SignupResponse = {
  error?: string;
  message?: string;
  userId?: string;
  fields?: Record<string, string>;
};

export type SignupServiceResult = {
  status: number;
  body: SignupResponse;
};

export type NormalizedSignupBody = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};
