import { describe, expect, it } from 'vitest'
import { AREA_CODES, DEFAULT_AREA_ISO, getAreaByIso, groupAreaCodes, HOT_AREA_CODES, searchAreaCodes } from './area-code'
import { getPhoneMaxLength, validatePhoneByAreaCode } from './auth'

describe('area code list', () => {
  it('keeps iso keys unique and defaults to mainland china', () => {
    expect(new Set(AREA_CODES.map(item => item.iso)).size).toBe(AREA_CODES.length)
    expect(getAreaByIso(DEFAULT_AREA_ISO).code).toBe('86')
    expect(getAreaByIso('NOT_EXIST').iso).toBe(DEFAULT_AREA_ISO)
    expect(HOT_AREA_CODES[0].iso).toBe('CN')
  })

  it('searches by chinese name, english name and dial code', () => {
    expect(searchAreaCodes('香港').map(item => item.code)).toEqual(['852'])
    expect(searchAreaCodes('singa').map(item => item.iso)).toEqual(['SG'])
    expect(searchAreaCodes('+852').map(item => item.iso)).toEqual(['HK'])
    expect(searchAreaCodes('不存在的地区')).toEqual([])
    expect(searchAreaCodes('  ')).toHaveLength(AREA_CODES.length)
  })

  it('groups by leading letter in alphabetical order', () => {
    const groups = groupAreaCodes()
    const letters = groups.map(group => group.letter)
    expect(letters).toEqual([...letters].sort())
    expect(groups.reduce((total, group) => total + group.items.length, 0)).toBe(AREA_CODES.length)
  })
})

describe('phone validation across area codes', () => {
  it('keeps the strict 11-digit rule for +86', () => {
    expect(getPhoneMaxLength('86')).toBe(11)
    expect(validatePhoneByAreaCode('13800138000', '86')).toBe('')
    expect(validatePhoneByAreaCode('138001380', '86')).toBe('请输入正确的 11 位手机号')
  })

  it('accepts 5-15 digits for overseas area codes', () => {
    expect(getPhoneMaxLength('852')).toBe(15)
    expect(validatePhoneByAreaCode('61234567', '852')).toBe('')
    expect(validatePhoneByAreaCode('', '852')).toBe('请输入手机号')
    expect(validatePhoneByAreaCode('1234', '852')).toBe('请输入正确的手机号')
  })
})
