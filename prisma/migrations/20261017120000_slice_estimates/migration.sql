-- CreateTable
CREATE TABLE "SliceEstimate" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "printSeconds" INTEGER NOT NULL,
    "filamentGrams" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SliceEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SliceEstimate_fileId_key_key" ON "SliceEstimate"("fileId", "key");

-- AddForeignKey
ALTER TABLE "SliceEstimate" ADD CONSTRAINT "SliceEstimate_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UploadedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
