import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';

export function useLogin() {
  return useMutation({
    mutationFn: (input: { username: string; password: string }) =>
      api.login(input.username, input.password),
  });
}
