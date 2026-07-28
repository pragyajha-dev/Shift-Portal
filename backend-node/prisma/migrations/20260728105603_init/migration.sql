-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Admin', 'Viewer');

-- CreateEnum
CREATE TYPE "EnvironmentSide" AS ENUM ('OutSystems', 'NewApp');

-- CreateTable
CREATE TABLE "Users" (
    "Id" TEXT NOT NULL,
    "FullName" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "PasswordHash" TEXT NOT NULL,
    "Role" "UserRole" NOT NULL,
    "MustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUserId" TEXT,
    "LastLoginAt" TIMESTAMP(3),

    CONSTRAINT "Users_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Projects" (
    "Id" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "CreatedByUserId" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedByUserId" TEXT,
    "UpdatedAt" TIMESTAMP(3),

    CONSTRAINT "Projects_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Environments" (
    "Id" TEXT NOT NULL,
    "ProjectId" TEXT NOT NULL,
    "Side" "EnvironmentSide" NOT NULL,
    "Name" TEXT NOT NULL,
    "Url" TEXT NOT NULL,
    "SortOrder" INTEGER NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Environments_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Credentials" (
    "Id" TEXT NOT NULL,
    "EnvironmentId" TEXT NOT NULL,
    "RoleLabel" TEXT NOT NULL,
    "Username" TEXT NOT NULL,
    "PasswordEncrypted" TEXT NOT NULL,
    "SortOrder" INTEGER NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credentials_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_Email_key" ON "Users"("Email");

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_CreatedByUserId_fkey" FOREIGN KEY ("CreatedByUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Projects" ADD CONSTRAINT "Projects_CreatedByUserId_fkey" FOREIGN KEY ("CreatedByUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Projects" ADD CONSTRAINT "Projects_UpdatedByUserId_fkey" FOREIGN KEY ("UpdatedByUserId") REFERENCES "Users"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Environments" ADD CONSTRAINT "Environments_ProjectId_fkey" FOREIGN KEY ("ProjectId") REFERENCES "Projects"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credentials" ADD CONSTRAINT "Credentials_EnvironmentId_fkey" FOREIGN KEY ("EnvironmentId") REFERENCES "Environments"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
