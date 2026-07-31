module.exports = {
  async up(db) {
    const collections = await db
      .listCollections({ name: 'suggestionhistories' })
      .toArray();
    if (collections.length === 0) {
      await db.createCollection('suggestionhistories');
    }

    // Add collection-level JSON Schema validation.
    // Enforces required fields at the MongoDB engine level,
    // independent of whether the app uses Mongoose or connects directly.
    await db.command({
      collMod: 'suggestionhistories',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['userId', 'criteria', 'suggestions', 'timestamp'],
          properties: {
            userId: { bsonType: 'string', description: 'required string' },
            criteria: { bsonType: 'object', description: 'required object' },
            suggestions: { bsonType: 'array', description: 'required array' },
            timestamp: { bsonType: 'date', description: 'required date' },
          },
        },
      },
      validationLevel: 'moderate',
      validationAction: 'error',
    });
  },

  async down(db) {
    await db.command({
      collMod: 'suggestionhistories',
      validator: {},
      validationLevel: 'off',
    });
  },
};
