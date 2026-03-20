export type LoginBody = {
    email?: string;
    password?: string;
};

export type LoginResponse = {
    error?: string;
    message?: string;
    userId?: string;
};

export type LoginServiceResult = {
    status: number;
    body: LoginResponse;
};

export type NormalizedLoginBody = {
    email: string;
    password: string;
};