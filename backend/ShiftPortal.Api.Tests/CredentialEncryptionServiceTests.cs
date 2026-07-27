using Microsoft.AspNetCore.DataProtection;
using ShiftPortal.Api.Services;
using Xunit;

namespace ShiftPortal.Api.Tests;

public class CredentialEncryptionServiceTests
{
    private static CredentialEncryptionService CreateService() =>
        new(new EphemeralDataProtectionProvider());

    [Fact]
    public void Encrypt_Then_Decrypt_ReturnsOriginalPlaintext()
    {
        var service = CreateService();
        const string plaintext = "Sup3r$ecretDbPassword!";

        var ciphertext = service.Encrypt(plaintext);
        var roundTripped = service.Decrypt(ciphertext);

        Assert.Equal(plaintext, roundTripped);
    }

    [Fact]
    public void Encrypt_DoesNotReturnPlaintextVerbatim()
    {
        var service = CreateService();
        const string plaintext = "Sup3r$ecretDbPassword!";

        var ciphertext = service.Encrypt(plaintext);

        Assert.NotEqual(plaintext, ciphertext);
        Assert.DoesNotContain(plaintext, ciphertext, StringComparison.Ordinal);
    }

    [Fact]
    public void Decrypt_WithWrongPurpose_ThrowsInsteadOfReturningGarbageSilently()
    {
        var provider = new EphemeralDataProtectionProvider();
        var encryptor = new CredentialEncryptionService(provider);
        var differentPurposeProtector = provider.CreateProtector("SomeOtherPurpose");

        var ciphertext = encryptor.Encrypt("value");

        Assert.ThrowsAny<Exception>(() => differentPurposeProtector.Unprotect(ciphertext));
    }

    [Fact]
    public void Decrypt_WithFreshProviderInstanceReadingSameKeyRing_StillDecrypts()
    {
        // Simulates an app restart: the key ring is read from disk by a brand-new
        // provider instance rather than reused in-memory, proving persisted keys
        // (not just the process's live key cache) are what makes decryption work.
        var keyRingDir = Directory.CreateTempSubdirectory("shiftportal-dp-test-");
        try
        {
            const string plaintext = "PersistsAcrossRestart123!";

            var providerBeforeRestart = DataProtectionProvider.Create(keyRingDir);
            var ciphertext = new CredentialEncryptionService(providerBeforeRestart).Encrypt(plaintext);

            var providerAfterRestart = DataProtectionProvider.Create(keyRingDir);
            var decrypted = new CredentialEncryptionService(providerAfterRestart).Decrypt(ciphertext);

            Assert.Equal(plaintext, decrypted);
        }
        finally
        {
            keyRingDir.Delete(recursive: true);
        }
    }
}
