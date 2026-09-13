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

-- CreateIndex
CREATE INDEX "Player_roomCode_idx" ON "Player"("roomCode");

-- CreateIndex
CREATE UNIQUE INDEX "Player_roomCode_seat_key" ON "Player"("roomCode", "seat");

-- CreateIndex
CREATE UNIQUE INDEX "Turn_roomCode_round_key" ON "Turn"("roomCode", "round");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_roomCode_fkey" FOREIGN KEY ("roomCode") REFERENCES "Room"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_roomCode_fkey" FOREIGN KEY ("roomCode") REFERENCES "Room"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_roomCode_fkey" FOREIGN KEY ("roomCode") REFERENCES "Room"("code") ON DELETE CASCADE ON UPDATE CASCADE;
