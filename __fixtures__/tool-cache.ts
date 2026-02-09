import type * as tc from '@actions/tool-cache'
import { jest } from '@jest/globals'

export const cacheDir = jest.fn<typeof tc.cacheDir>()
export const downloadTool = jest.fn<typeof tc.downloadTool>()
export const extractTar = jest.fn<typeof tc.extractTar>()
export const extractZip = jest.fn<typeof tc.extractZip>()
export const find = jest.fn<typeof tc.find>()
