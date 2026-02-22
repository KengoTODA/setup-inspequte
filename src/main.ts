import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'

const TOOL_NAME = 'inspequte'
const TOOL_REPOSITORY = 'KengoTODA/inspequte'

type InstallTarget = {
  targetTriple: string
  targetTripleAliases: string[]
  archiveExtension: 'tar.gz' | 'zip'
}

type GitHubReleaseAsset = {
  name?: string
  browser_download_url?: string
}

type GitHubRelease = {
  tag_name?: string
  name?: string
  draft?: boolean
  prerelease?: boolean
  assets?: GitHubReleaseAsset[]
}

type ResolvedReleaseAsset = {
  tagName: string
  downloadUrl: string
}

/**
 * Resolve release asset details from the current runner platform.
 */
export function resolveInstallTarget(
  platform: NodeJS.Platform,
  arch: string
): InstallTarget {
  if (platform === 'linux' && arch === 'x64') {
    return {
      targetTriple: 'x86_64-unknown-linux-gnu',
      targetTripleAliases: ['amd64-unknown-linux-gnu'],
      archiveExtension: 'tar.gz'
    }
  }

  if (platform === 'linux' && arch === 'arm64') {
    return {
      targetTriple: 'aarch64-unknown-linux-gnu',
      targetTripleAliases: ['arm64-unknown-linux-gnu'],
      archiveExtension: 'tar.gz'
    }
  }

  if (platform === 'darwin' && arch === 'arm64') {
    return {
      targetTriple: 'aarch64-apple-darwin',
      targetTripleAliases: ['arm64-apple-darwin'],
      archiveExtension: 'tar.gz'
    }
  }

  if (platform === 'darwin' && arch === 'x64') {
    return {
      targetTriple: 'x86_64-apple-darwin',
      targetTripleAliases: ['amd64-apple-darwin'],
      archiveExtension: 'tar.gz'
    }
  }

  if (platform === 'win32' && arch === 'x64') {
    return {
      targetTriple: 'x86_64-pc-windows-msvc',
      targetTripleAliases: ['amd64-pc-windows-msvc'],
      archiveExtension: 'zip'
    }
  }

  throw new Error(`Unsupported platform/arch combination: ${platform}/${arch}`)
}

/**
 * Normalize action input into a release tag.
 */
export function normalizeVersionInput(versionInput: string): string {
  if (versionInput === '') {
    return ''
  }

  if (versionInput.startsWith(`${TOOL_NAME}-`)) {
    return versionInput
  }

  return versionInput.startsWith('v')
    ? `${TOOL_NAME}-${versionInput}`
    : `${TOOL_NAME}-v${versionInput}`
}

/**
 * Convert release tag into a version string for @actions/tool-cache.
 */
export function toCacheVersion(releaseTag: string): string {
  const toolPrefix = `${TOOL_NAME}-`
  const normalizedTag = releaseTag.startsWith(toolPrefix)
    ? releaseTag.slice(toolPrefix.length)
    : releaseTag

  return normalizedTag.startsWith('v') ? normalizedTag.slice(1) : normalizedTag
}

/**
 * Fetch release metadata by tag from GitHub.
 */
export async function getReleaseByTag(tagName: string): Promise<GitHubRelease> {
  const response = await fetch(
    `https://api.github.com/repos/${TOOL_REPOSITORY}/releases/tags/${encodeURIComponent(tagName)}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'setup-inspequte'
      }
    }
  )

  if (!response.ok) {
    throw new Error(
      `Failed to fetch inspequte release ${tagName}: ${response.status} ${response.statusText}`
    )
  }

  return (await response.json()) as GitHubRelease
}

/**
 * Fetch release metadata list from GitHub.
 */
export async function getReleases(): Promise<GitHubRelease[]> {
  const response = await fetch(
    `https://api.github.com/repos/${TOOL_REPOSITORY}/releases?per_page=100`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'setup-inspequte'
      }
    }
  )

  if (!response.ok) {
    throw new Error(
      `Failed to fetch inspequte releases: ${response.status} ${response.statusText}`
    )
  }

  return (await response.json()) as GitHubRelease[]
}

const RELEASE_TAG_PREFIX = `${TOOL_NAME}-v`

function hasCliReleasePrefix(value?: string): boolean {
  return value?.startsWith(RELEASE_TAG_PREFIX) === true
}

function isCliRelease(release: GitHubRelease): boolean {
  return (
    hasCliReleasePrefix(release.tag_name) || hasCliReleasePrefix(release.name)
  )
}

/**
 * Find the release asset that matches current runner target.
 */
export function findReleaseAsset(
  release: GitHubRelease,
  target: InstallTarget
): GitHubReleaseAsset | undefined {
  const supportedTriples = [target.targetTriple, ...target.targetTripleAliases]
  return release.assets?.find(
    (asset) =>
      supportedTriples.some(
        (triple) => asset.name?.endsWith(`-${triple}.${target.archiveExtension}`) === true
      ) &&
      asset.browser_download_url !== undefined
  )
}

/**
 * Resolve release tag and downloadable asset URL.
 */
export async function resolveReleaseAsset(
  versionInput: string,
  target: InstallTarget
): Promise<ResolvedReleaseAsset> {
  if (versionInput !== '') {
    const normalizedVersion = normalizeVersionInput(versionInput)
    const release = await getReleaseByTag(normalizedVersion)
    const asset = findReleaseAsset(release, target)
    if (!release.tag_name || !asset?.browser_download_url) {
      throw new Error(
        `No downloadable inspequte asset found for ${target.targetTriple} in ${normalizedVersion}`
      )
    }

    return {
      tagName: release.tag_name,
      downloadUrl: asset.browser_download_url
    }
  }

  const releases = await getReleases()
  for (const release of releases) {
    if (
      !release.tag_name ||
      release.draft ||
      release.prerelease ||
      !isCliRelease(release)
    ) {
      continue
    }

    const asset = findReleaseAsset(release, target)
    if (asset?.browser_download_url) {
      return {
        tagName: release.tag_name,
        downloadUrl: asset.browser_download_url
      }
    }
  }

  throw new Error(
    `No stable inspequte release includes an asset for ${target.targetTriple}`
  )
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const target = resolveInstallTarget(process.platform, process.arch)
    const resolved = await resolveReleaseAsset(core.getInput('version'), target)
    const cacheVersion = toCacheVersion(resolved.tagName)

    core.info(
      `Setting up inspequte ${resolved.tagName} for ${target.targetTriple}`
    )

    const cachedPath = tc.find(TOOL_NAME, cacheVersion, process.arch)
    if (cachedPath !== '') {
      core.info(`Using cached inspequte at ${cachedPath}`)
      core.addPath(cachedPath)
      core.setOutput('version', resolved.tagName)
      return
    }

    core.info(`Downloading inspequte from ${resolved.downloadUrl}`)
    const archivePath = await tc.downloadTool(resolved.downloadUrl)
    const extractedPath =
      target.archiveExtension === 'tar.gz'
        ? await tc.extractTar(archivePath)
        : await tc.extractZip(archivePath)

    const toolPath = await tc.cacheDir(
      extractedPath,
      TOOL_NAME,
      cacheVersion,
      process.arch
    )

    core.addPath(toolPath)
    core.setOutput('version', resolved.tagName)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
