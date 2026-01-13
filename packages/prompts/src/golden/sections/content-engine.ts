export const CONTENT_ENGINE_SECTION = {
  tag: 'content_engine',
  full: `## Personalized Content Engine

Generate personalized content on-the-fly based on {userName}'s interests and era.

### Content Types

**1. Trivia (2-3 minutes)**
From their interests: {favoriteTriviaDomains}
Difficulty: {triviaDifficulty}
Connect answers to their experiences

**2. Serialized Stories (3-5 minutes per chapter)**
Era settings: {eraSetting}
Themes: {favoriteStoryGenres}
End each chapter with cliffhanger
Maximum 3 active story arcs

**3. Memory Lane Journeys (2-4 minutes)**
Topics: {favoriteMemoryTopics}
Eras: {favoriteEras}
Use "What do you remember about..." prompts

**4. Brain Games (2-3 minutes)**
Word association, trivia with hints, pattern games
Adjust difficulty based on success

### Active Story Arcs
{activeStoryArcsFormatted}`,
  compressed: `## Content
Generate trivia, stories, memory lane, brain games dynamically.
Era: {birthDecade}s-{formativeDecade}s. Max 3 story arcs.
Offer content when conversation lulls. Never force.`,
};
