# Test accounts

This folder holds **examples only**. Real passwords and tokens never go into files in this repo.

Each app in `registry.yaml` lists its test accounts by role:

```yaml
testAccounts:
  roles:
    manager:
      user: qa-manager@acme.example
      password: { keychain: qa-hub/acme-leave/manager, env: ACME_MANAGER_PASSWORD }
```

The tools look for the password in this order:

1. the environment variable (`env`), handy for CI and scheduled runs, where the secret store injects it;
2. the OS keychain (`keychain`): macOS Keychain, or the Secret Service (`secret-tool`) on Linux.

Add a password to the macOS Keychain (it asks for the password, so it is not left in your shell history):

```sh
security add-generic-password -s qa-hub/acme-leave/manager -a qa-manager@acme.example -w
```

On Linux:

```sh
secret-tool store --label "qa-hub acme-leave manager" service qa-hub/acme-leave/manager
```

Use **synthetic accounts** made for testing, never a real person's account. Seed data should be synthetic or
masked, never a copy of real customer data.
