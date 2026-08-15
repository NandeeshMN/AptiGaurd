/**
 * Converts raw Firebase authentication error codes into user-friendly messages.
 */
export const getFriendlyErrorMessage = (error: any): string => {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const code = error.code || '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/network-request-failed':
      return 'Unable to connect. Please check your internet connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact administration.';
    case 'auth/too-many-requests':
      return 'Access to this account has been temporarily disabled due to many failed login attempts. Please try again later.';
    default:
      // Check for messages indicating general connectivity failure
      const message = error.message || '';
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
        return 'Unable to connect. Please check your internet connection and try again.';
      }
      // If there's no Firebase error code, it's likely a custom error thrown by our backend fetch
      if (!code && message) {
        return message;
      }
      return 'An error occurred during authentication. Please try again.';
  }
};
