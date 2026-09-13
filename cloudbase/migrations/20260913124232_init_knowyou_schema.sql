-- CreateEnum
CREATE TYPE "RoomState" AS ENUM ('waiting', 'playing', 'finished');

-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('idle', 'pending', 'error');

-- CreateEnum
CREATE TYPE "PlayerRole" AS ENUM ('a', 'b');

-- CreateTable
CREATE TABLE "Room" (
    "code" TEXT NOT NULL,
    "state" "RoomState" NOT NULL DEFAULT 'waiting',
    "round" INTEGER NOT NULL DEFAULT 0,
    "narration" TEXT NOT NULL DEFAULT '',
    "scene" TEXT NOT NULL DEFAULT '',
    "isEnding" BOOLEAN NOT NULL DEFAULT false,
    "endingReason" TEXT NOT NULL DEFAULT '',
    "aiStatus" "AiStatus" NOT NULL DEFAULT 'idle',
    "aiError" TEXT NOT NULL DEFAULT '',
    "choices" JSONB NOT NULL DEFAULT '[]',
    "submissions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PlayerRole" NOT NULL,
    "seat" INTEGER NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turn" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "entries" JSONB NOT NULL,
    "narration" TEXT NOT NULL,

    CONSTRAINT "Turn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "roomCode" TEXT NOT NULL,
    "common" TEXT[],
    "differences" TEXT[],
    "complement" TEXT NOT NULL,
    "topics" TEXT[],

    CONSTRAINT "Report_pkey" PRIMARY KEY ("roomCode")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "zhihuUid" TEXT NOT NULL,
    "hashId" TEXT NOT NULL DEFAULT '',
    "fullname" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT NOT NULL DEFAULT '',
    "headline" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oauthAccessToken" TEXT NOT NULL,
    "oauthTokenExpires" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "OauthState" (
    "state" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OauthState_pkey" PRIMARY KEY ("state")
);

-- CreateIndex
CREATE INDEX "Player_roomCode_idx" ON "Player"("roomCode");

-- CreateIndex
CREATE UNIQUE INDEX "Player_roomCode_seat_key" ON "Player"("roomCode", "seat");

-- CreateIndex
CREATE UNIQUE INDEX "Turn_roomCode_round_key" ON "Turn"("roomCode", "round");

-- CreateIndex
CREATE UNIQUE INDEX "User_zhihuUid_key" ON "User"("zhihuUid");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "OauthState_expiresAt_idx" ON "OauthState"("expiresAt");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_roomCode_fkey" FOREIGN KEY ("roomCode") REFERENCES "Room"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_roomCode_fkey" FOREIGN KEY ("roomCode") REFERENCES "Room"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_roomCode_fkey" FOREIGN KEY ("roomCode") REFERENCES "Room"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
