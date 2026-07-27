using System.Security.Cryptography;

namespace ShiftPortal.Api.Services;

public static class TemporaryPasswordGenerator
{
    private const string Chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";

    public static string Generate(int length = 12)
    {
        var bytes = RandomNumberGenerator.GetBytes(length);
        var chars = new char[length];
        for (var i = 0; i < length; i++)
        {
            chars[i] = Chars[bytes[i] % Chars.Length];
        }
        return new string(chars);
    }
}
