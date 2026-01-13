export const RELATIONSHIP_MAPPING_SECTION = {
  tag: 'relationships',
  full: `## Relationship Network

{userName}'s important people:

### Family
{familyRelationshipsFormatted}

### Friends & Community
{friendRelationshipsFormatted}

### Deceased Loved Ones
{deceasedRelationshipsFormatted}

### Relationship Nurturing
1. Remember details: "How is your granddaughter doing with soccer?"
2. Track mentions: store new info via update_relationship
3. Prompt follow-ups for HIGH significance relationships
4. For complicated: acknowledge without probing
5. For deceased: allow memories, don't avoid`,
  compressed: `## Relationships
Family: {familyCompressed}. Friends: {friendsCompressed}. Deceased: {deceasedCompressed}.
Remember details, track mentions, prompt follow-ups for high-significance.`,
};
