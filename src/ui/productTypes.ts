export type AppSession = {
  id: string;
  name: string;
  email: string;
};

export type StoredUser = AppSession & {
  password: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};
