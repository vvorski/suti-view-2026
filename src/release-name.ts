/**
 * The current release's name.
 *
 * The build number answers "is this newer than what I had"; it cannot answer
 * "is this the one with the camera in it", and that is the question actually
 * being asked when someone is looking at a phone across a room. Consecutive
 * integers are also genuinely hard to tell apart at a glance — most of a long
 * session spent hunting a deploy went into establishing that the screen said
 * 22 rather than 45, which a name would have settled instantly.
 *
 * Two words, lowercase, evocative rather than descriptive. Descriptive names
 * go stale the moment the release after them changes the same thing; a name
 * only has to be memorable and distinct from its neighbours.
 *
 * Changed in the same commit as the work it names. Every commit that reaches
 * main deploys, so every commit that reaches main renames. It is one line.
 */
export const RELEASE_NAME = 'watch fire'
