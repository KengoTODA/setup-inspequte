import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import * as tc from '../__fixtures__/tool-cache.js'

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/tool-cache', () => tc)

const {
  run,
  normalizeVersionInput,
  resolveReleaseAsset,
  resolveInstallTarget,
  toCacheVersion
} = await import('../src/main.js')

describe('main.ts', () => {
  const originalFetch = global.fetch
  const fetchMock = jest.fn<typeof fetch>()

  beforeEach(() => {
    global.fetch = fetchMock
    core.getInput.mockImplementation((name) =>
      name === 'version' ? '' : 'unexpected'
    )
    tc.find.mockReturnValue('')
    tc.downloadTool.mockResolvedValue('/tmp/inspequte.tar.gz')
    tc.extractTar.mockResolvedValue('/tmp/extracted')
    tc.extractZip.mockResolvedValue('/tmp/extracted')
    tc.cacheDir.mockResolvedValue('/tmp/cached-tool')
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.resetAllMocks()
  })

  it('Installs the latest release by default', async () => {
    const target = resolveInstallTarget(process.platform, process.arch)
    const assetUrl = 'https://example.com/inspequte.tar.gz'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [
        {
          tag_name: 'inspequte-v0.13.0',
          assets: [
            {
              name: `inspequte-inspequte-v0.13.0-${target.targetTriple}.${target.archiveExtension}`,
              browser_download_url: assetUrl
            }
          ]
        }
      ]
    } as Response)

    await run()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(tc.downloadTool).toHaveBeenCalledWith(assetUrl)
    expect(tc.cacheDir).toHaveBeenCalledWith(
      '/tmp/extracted',
      'inspequte',
      '0.13.0',
      process.arch
    )
    expect(core.addPath).toHaveBeenCalledWith('/tmp/cached-tool')
    expect(core.setOutput).toHaveBeenCalledWith('version', 'inspequte-v0.13.0')
  })

  it('Installs the requested version', async () => {
    const target = resolveInstallTarget(process.platform, process.arch)
    const requestedAssetTriple =
      target.targetTripleAliases[0] ?? target.targetTriple
    const assetUrl = 'https://example.com/inspequte.tar.gz'
    core.getInput.mockImplementation((name) =>
      name === 'version' ? '0.16.0' : 'unexpected'
    )
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        tag_name: 'inspequte-v0.16.0',
        assets: [
          {
            name: `inspequte-v0.16.0-${requestedAssetTriple}.${target.archiveExtension}`,
            browser_download_url: assetUrl
          }
        ]
      })
    } as Response)

    await run()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/KengoTODA/inspequte/releases/tags/inspequte-v0.16.0',
      expect.anything()
    )
    expect(tc.downloadTool).toHaveBeenCalledWith(assetUrl)
    expect(core.setOutput).toHaveBeenCalledWith('version', 'inspequte-v0.16.0')
  })

  it('Uses the tool cache when available', async () => {
    const target = resolveInstallTarget(process.platform, process.arch)
    tc.find.mockReturnValue('/tmp/cached-inspequte')
    core.getInput.mockImplementation((name) =>
      name === 'version' ? 'v2.0.0' : 'unexpected'
    )
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        tag_name: 'inspequte-v2.0.0',
        assets: [
          {
            name: `inspequte-inspequte-v2.0.0-${target.targetTriple}.${target.archiveExtension}`,
            browser_download_url: 'https://example.com/inspequte.tar.gz'
          }
        ]
      })
    } as Response)

    await run()

    expect(tc.find).toHaveBeenCalledWith('inspequte', '2.0.0', process.arch)
    expect(tc.downloadTool).not.toHaveBeenCalled()
    expect(tc.extractTar).not.toHaveBeenCalled()
    expect(tc.extractZip).not.toHaveBeenCalled()
    expect(tc.cacheDir).not.toHaveBeenCalled()
    expect(core.addPath).toHaveBeenCalledWith('/tmp/cached-inspequte')
    expect(core.setOutput).toHaveBeenCalledWith('version', 'inspequte-v2.0.0')
  })

  it('Sets failed status when release lookup fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({})
    } as Response)

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to fetch inspequte releases: 500 Internal Server Error'
    )
  })

  it('Resolve release from list and skip non-CLI releases', async () => {
    const target = resolveInstallTarget(process.platform, process.arch)
    const latestAssetTriple =
      target.targetTripleAliases[0] ?? target.targetTriple
    const assetUrl = 'https://example.com/inspequte.tar.gz'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [
        {
          tag_name: 'inspequte-v9.9.9',
          draft: false,
          prerelease: false,
          assets: []
        },
        {
          tag_name: 'gradle-plugin-v9.9.9',
          name: 'gradle-plugin-v9.9.9',
          draft: false,
          prerelease: false,
          assets: [
            {
              name: `inspequte-gradle-plugin-${target.targetTriple}.${target.archiveExtension}`,
              browser_download_url: 'https://example.com/gradle-plugin.tar.gz'
            }
          ]
        },
        {
          tag_name: 'inspequte-v0.16.0',
          draft: false,
          prerelease: false,
          assets: [
            {
              name: `inspequte-v0.16.0-${latestAssetTriple}.${target.archiveExtension}`,
              browser_download_url: assetUrl
            }
          ]
        }
      ]
    } as Response)

    await expect(resolveReleaseAsset('', target)).resolves.toEqual({
      tagName: 'inspequte-v0.16.0',
      downloadUrl: assetUrl
    })
  })

  it('Normalizes version input and cache version', () => {
    expect(normalizeVersionInput('')).toBe('')
    expect(normalizeVersionInput('1.2.3')).toBe('inspequte-v1.2.3')
    expect(normalizeVersionInput('v1.2.3')).toBe('inspequte-v1.2.3')
    expect(normalizeVersionInput('inspequte-v1.2.3')).toBe('inspequte-v1.2.3')
    expect(toCacheVersion('inspequte-v1.2.3')).toBe('1.2.3')
    expect(toCacheVersion('v1.2.3')).toBe('1.2.3')
    expect(toCacheVersion('1.2.3')).toBe('1.2.3')
  })

  it('Throws on unsupported platform combinations', () => {
    expect(resolveInstallTarget('linux', 'arm64')).toEqual({
      targetTriple: 'aarch64-unknown-linux-gnu',
      targetTripleAliases: ['arm64-unknown-linux-gnu'],
      archiveExtension: 'tar.gz'
    })
    expect(resolveInstallTarget('darwin', 'x64')).toEqual({
      targetTriple: 'x86_64-apple-darwin',
      targetTripleAliases: ['amd64-apple-darwin'],
      archiveExtension: 'tar.gz'
    })
    expect(() => resolveInstallTarget('linux', 'ppc64')).toThrow(
      'Unsupported platform/arch combination: linux/ppc64'
    )
  })
})
