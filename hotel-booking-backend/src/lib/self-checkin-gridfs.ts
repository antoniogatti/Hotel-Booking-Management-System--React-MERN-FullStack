import { Readable } from "stream";
import { GridFSBucket, ObjectId } from "mongodb";
import mongoose from "mongoose";

const GRIDFS_BUCKET_NAME = "selfcheckin_files";

type StoredFileRef = {
  gridFsId: ObjectId;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
};

const getBucket = () => {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB is not connected");
  }

  return new GridFSBucket(mongoose.connection.db, {
    bucketName: GRIDFS_BUCKET_NAME,
  });
};

export const saveSelfCheckinFileToGridFS = async (params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<StoredFileRef> => {
  const bucket = getBucket();
  const uploadedAt = new Date();

  const uploadStream = bucket.openUploadStream(params.filename, {
    contentType: params.mimeType,
    metadata: {
      uploadedAt,
    },
  });

  await new Promise<void>((resolve, reject) => {
    Readable.from(params.buffer)
      .pipe(uploadStream)
      .on("error", reject)
      .on("finish", () => resolve());
  });

  return {
    gridFsId: uploadStream.id as ObjectId,
    filename: params.filename,
    mimeType: params.mimeType,
    size: params.buffer.length,
    uploadedAt,
  };
};

export const getSelfCheckinFileStream = async (fileId: string) => {
  const bucket = getBucket();
  const objectId = new ObjectId(fileId);
  const filesCollection = mongoose.connection.db.collection(`${GRIDFS_BUCKET_NAME}.files`);
  const fileDoc = await filesCollection.findOne({ _id: objectId });

  if (!fileDoc) {
    return null;
  }

  const stream = bucket.openDownloadStream(objectId);
  return { stream, fileDoc };
};

export const deleteSelfCheckinFileFromGridFS = async (fileId: string) => {
  const bucket = getBucket();
  const objectId = new ObjectId(fileId);
  await bucket.delete(objectId);
};
