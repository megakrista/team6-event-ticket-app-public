export type VenueResponse = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
};

export type VenueInput = {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

export type VenueValidationErrors = {
  [field: string]: string;
};

type VenueValidationFailure = {
  status: 400;
  validationErrors: VenueValidationErrors;
};

type VenueWriteError =
  | { status: 404; error: "Venue not found" }
  | { status: 409; error: string }
  | { status: 500; error: "Internal server error" };

type VenueWriteSuccess = {
  status: 200 | 201;
  venue: VenueResponse;
};

export type VenueWriteResult = VenueValidationFailure | VenueWriteError | VenueWriteSuccess;
