using Microsoft.AspNetCore.DataProtection;

namespace ShiftPortal.Api.Services;

// Wraps Data Protection with a fixed purpose string so credential passwords are
// cryptographically isolated from any other use of Data Protection in this app
// (e.g. auth cookies, if added later). Reversible by design: unlike portal login
// passwords (one-way bcrypt hash), stored application credentials must be
// decryptable for display/export.
public class CredentialEncryptionService
{
    private readonly IDataProtector _protector;

    public CredentialEncryptionService(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("ShiftPortal.CredentialPassword.v1");
    }

    public string Encrypt(string plaintext) => _protector.Protect(plaintext);

    public string Decrypt(string ciphertext) => _protector.Unprotect(ciphertext);
}
