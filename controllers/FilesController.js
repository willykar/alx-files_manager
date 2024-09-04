const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const { ObjectID } = require('mongodb');
const path = require('path');
const mime = require('mime-types');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class FilesController {
  static async getUser(request) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (userId) {
      const idObjectUser = new ObjectID(userId);
      const user = await (await dbClient.usersCollection()).findOne({ _id: idObjectUser });
      if (!user) {
        return null;
      }
      return user;
    }
    return null;
  }

  static async postUpload(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId, isPublic = false, data,
    } = request.body;

    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }
    if (!type) {
      return response.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return response.status(400).json({ error: 'Missing data' });
    }

    if (parentId) {
      const idObject = new ObjectID(parentId);
      const file = await (await dbClient.filesCollection()).findOne({ _id: idObject });
      if (!file) {
        return response.status(400).json({ error: 'Parent not found' });
      }
      if (file.type !== 'folder') {
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    if (type === 'folder') {
      try {
        const result = await (await dbClient.filesCollection()).insertOne({
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
          localPath: null,
        });
        return response.status(201).json({
          id: result.insertedId,
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
        });
      } catch (error) {
        console.log(error);
        return response.status(500).json({ error: 'Failed to save folder' });
      }
    } else {
      const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const fileName = `${filePath}/${uuidv4()}`;
      const buff = Buffer.from(data, 'base64');

      try {
        await fs.mkdir(filePath, { recursive: true });
        await fs.writeFile(fileName, buff);
      } catch (error) {
        console.log(error);
        return response.status(500).json({ error: 'Failed to save file' });
      }

      try {
        const result = await (await dbClient.filesCollection()).insertOne({
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
          localPath: fileName,
        });
        return response.status(201).json({
          id: result.insertedId,
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
        });
      } catch (error) {
        console.log(error);
        return response.status(500).json({ error: 'Failed to save file record' });
      }
    }
  }

  static async getShow(req, res) {
    try {
      const user = await FilesController.getUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const userId = new ObjectID(user._id);
      const fileId = new ObjectID(req.params.id);
      const file = await (await dbClient.filesCollection()).findOne({ _id: fileId, userId });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }
      return res.status(200).json(file);
    } catch (error) {
      console.error('Error in getShow:');
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getIndex(request, response) {
    try {
      const user = await FilesController.getUser(request);
      if (!user) {
        return response.status(401).json({ error: 'Unauthorized' });
      }

      const { parentId, page } = request.query;
      const pageNum = parseInt(page, 10) || 0;
      const query = !parentId ? { userId: user._id }
        : { userId: user._id, parentId: new ObjectID(parentId) };

      const filesCollection = await dbClient.filesCollection();

      const result = await filesCollection.aggregate([
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }, { $addFields: { page: pageNum } }],
            data: [{ $skip: 20 * pageNum }, { $limit: 20 }],
          },
        },
      ]).toArray();

      if (result && result.length > 0) {
        const final = result[0].data.map((file) => {
          const tempFile = { ...file, id: file._id };
          delete tempFile._id;
          delete tempFile.localPath;
          return tempFile;
        });
        return response.status(200).json(final);
      }

      return response.status(404).json({ error: 'Not found' });
    } catch (error) {
      console.error('Error in getIndex:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putPublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params;
    const files = await dbClient.filesCollection();
    const idObject = new ObjectID(id);
    const newValue = { $set: { isPublic: true } };
    const options = { returnOriginal: false };
    files.findOneAndUpdate({ _id: idObject, userId: user._id }, newValue, options, (err, file) => {
      if (!file.lastErrorObject.updatedExisting) {
        return response.status(404).json({ error: 'Not found' });
      }
      return response.status(200).json(file.value);
    });
    return null;
  }

  static async putUnpublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params;
    const files = await dbClient.filesCollection();
    const idObject = new ObjectID(id);
    const newValue = { $set: { isPublic: false } };
    const options = { returnOriginal: false };
    files.findOneAndUpdate({ _id: idObject, userId: user._id }, newValue, options, (err, file) => {
      if (!file.lastErrorObject.updatedExisting) {
        return response.status(404).json({ error: 'Not found' });
      }
      return response.status(200).json(file.value);
    });
    return null;
  }

  static async getFile(request, response) {
    const { id } = request.params;
    const files = dbClient.db.collection('files');
    const idObject = new ObjectID(id);

    try {
      const file = await files.findOne({ _id: idObject });

      if (!file) {
        return response.status(404).json({ error: 'Not found' });
      }

      if (file.type === 'folder') {
        return response.status(400).json({ error: "A folder doesn't have content" });
      }

      if (!file.isPublic) {
        const user = await FilesController.getUser(request);
        if (!user || file.userId.toString() !== user._id.toString()) {
          return response.status(404).json({ error: 'Not found' });
        }
      }

      const filePath = file.localPath;
      if (!fs.existsSync(filePath)) {
        return response.status(404).json({ error: 'Not found' });
      }

      const mimeType = mime.lookup(path.extname(file.name)) || 'application/octet-stream'; // Default MIME type
      const data = fs.readFileSync(filePath); // Synchronous for simplicity

      response.setHeader('Content-Type', mimeType);
      return response.status(200).send(data);
    } catch (error) {
      console.error('Error in getFile:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = FilesController;
