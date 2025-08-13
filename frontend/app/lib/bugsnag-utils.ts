import { bugsnagClient } from './bugsnag';

/**
 * Report an error to Bugsnag (only in production)
 */
export const reportError = (error: Error | string, context?: Record<string, any>) => {
  if (import.meta.env.PROD) {
    if (typeof error === 'string') {
      bugsnagClient.notify(new Error(error), (event) => {
        if (context) {
          event.addMetadata('context', context);
        }
      });
    } else {
      bugsnagClient.notify(error, (event) => {
        if (context) {
          event.addMetadata('context', context);
        }
      });
    }
  }
};

/**
 * Add user information to Bugsnag (only in production)
 */
export const setUser = (id: string, email?: string, name?: string) => {
  if (import.meta.env.PROD) {
    bugsnagClient.setUser(id, email, name);
  }
};

/**
 * Add metadata to Bugsnag (only in production)
 */
export const addMetadata = (section: string, data: Record<string, any>) => {
  if (import.meta.env.PROD) {
    bugsnagClient.addMetadata(section, data);
  }
};


