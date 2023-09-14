const { requestOptions } = require('./bot_util')

let wikitext



const fetchFromYugipedia = async (cardName, cardPageId, cardPageTitle) => {
  const CARDS = []
  
  try {
    console.log(`📖 SEARCHING YUGIPEDIA... 【${cardName || cardPageId || cardPageTitle}】`)
    let wikiContent
    
    if (cardPageId) {
      cardPageId = cardPageId.join('|')
      wikiContent = await fetch(`${process.env.YUGIPEDIA_PAGEID}${cardPageId}`, requestOptions)
      wikiContent = await wikiContent.json()
    } else if (cardPageTitle) {
      cardPageTitle = cardPageTitle.join('|')
      wikiContent = await fetch(`${process.env.YUGIPEDIA_PAGETITLE}${cardPageTitle}`, requestOptions)
      wikiContent = await wikiContent.json()
    } else if (cardName) {
      let response = await fetch(`${process.env.YUGIPEDIA_SEARCH}${encodeURIComponent(cardName)}`, requestOptions)
      response = await response.json()
    
      const pageId = response.query.search[0]?.pageid
      if (!pageId) return CARDS
    
      wikiContent = await fetch(`${process.env.YUGIPEDIA_PAGEID}${pageId}`, requestOptions)
      wikiContent = await wikiContent.json()
    }
    
    const pages = wikiContent.query.pages
    if (pages.length) {
      for (let page of pages) {
        const name = page.title
        wikitext = page.revisions[0].content

        let card = createYugipediaCard(name)
        if (card.length) {
          card = card[0]
          card.pageId = page.pageid
          const alias = getProperty('alt_name')
          const transName = getProperty('trans_name')
          if (alias || transName) card.alias = alias || transName
          CARDS.push(card)
        }
      }
    }
    
    return CARDS
  } catch (err) {
    console.log(`🔴 [[ ${cardName} ]] YUGIPEDIA LOOKUP ERROR:`, err.message)
    console.log("🔷 STACK:", err.stack)
    return CARDS
  }
}

const createYugipediaCard = (cardName) => {
  const CARD = []
  const wikitextSubstring = wikitext.substring(0, 300).toLowerCase()

  let category
  let official
  if (wikitextSubstring.startsWith('{{anime') || wikitextSubstring.startsWith('{{duel links')) {
    category  = 'stray'
    official = false
  } else if (wikitextSubstring.startsWith('{{unofficial')) {
    official = false
  } else if (wikitextSubstring.startsWith('{{cardtable2') || wikitextSubstring.includes('{{cardtable2')) {
    official = true
  } else {
    official = false
  }

  let name = cardName
  let type = getProperty('card_type')
  let types = getProperty('types')
  let lore = getProperty('lore')
  let image = getProperty('image')
  let requirement = getProperty('requirement')
  let isRush = getProperty('rush_duel')
  if (!category) category = (requirement || isRush) ? 'rush' : 'ocg'

  if (!lore || (!types && !lore)) return CARD
  
  if (['Spell', 'Trap'].includes(type)) {
    let property = getProperty('property')

    if (requirement) {
      lore = `[REQUIREMENT] ${requirement} [EFFECT] ${lore}`
      category = 'rush'
    } else {
      category = category || 'ocg'
    }

    CARD.push({ name, type, property, lore, image, category, official })
    return CARD
  }

  if (type === 'Skill' && category === 'rush') {
    if (requirement) {
      lore = `[REQUIREMENT] ${requirement} [EFFECT] ${lore}`
      CARD.push({ name, type, requirement, lore, image, category, official })
      return CARD
    } else {
      CARD.push({ name, type, lore, image, category, official })
      return CARD
    }
  }

  if (types.includes('Skill') || wikitextSubstring.startsWith('{{duel links skill')) {
    type = 'Skill'
    category = category || 'ocg'

    CARD.push({ name, type, types, lore, image, category, official })
    return CARD
  }

  if (!types && lore) {
    category = 'stray'
    CARD.push({ name, lore, category, official })
    return CARD
  }

  type = 'Monster'
  let attribute = getProperty('attribute')
  let atk = getProperty('atk')
  let def = getProperty('def')
  let level = getProperty('level')
  let linkArrows
  let linkRating
  let scale
  let pendulum_effect
  
  if (types.includes('Xyz')) level = getProperty('rank') || level

  if (types.includes('Link')) {
    linkArrows = getProperty('link_arrows')
    linkRating = linkArrows.length.toString()
    
    CARD.push({ name, type, attribute, types, linkArrows, atk, linkRating, lore, image, category, official })
    return CARD
  }

  if (types.includes('Pendulum')) {
    scale = getProperty('pendulum_scale')
    pendulum_effect = getProperty('pendulum_effect')

    if (pendulum_effect) lore = `[ Pendulum Effect ] ${pendulum_effect} [ Monster Effect ] ${lore}`

    CARD.push({ name, type, attribute, types, level, scale, atk, def, lore, image, category, official })
    return CARD
  }

  if (category === 'rush') {
    let effectTypes = getProperty('effect_types')
    if (effectTypes && effectTypes.includes('Continuous')) effectTypes = `[CONTINUOUS EFFECT]`
    else if (effectTypes && effectTypes.includes('Multi-Choice')) effectTypes = `[MULTI-CHOICE EFFECT]`
    else effectTypes = `[EFFECT]`
    
    if (requirement) lore = `[REQUIREMENT] ${requirement} ${effectTypes} ${lore}`

    CARD.push({ name, type, attribute, types, level, atk, def, lore, image, category, official })
    return CARD
  }

  CARD.push({ name, type, attribute, types, level, atk, def, lore, image, category, official })
  return CARD
}

const getProperty = (prop) => {
  let regex = new RegExp(`\\| ${prop} += +.+\n`)
  if (prop === 'image') regex = new RegExp('\\| image += +([^|]*)')
  
  let propValue = wikitext.match(regex)
  if (propValue) {
    propValue = propValue[0].split(' = ')
    propValue = propValue[1].trim()
  } else {
    if (prop === 'image') {
      let image = getProperty('ja_image')
      return image ? `${process.env.YUGIPEDIA_IMG}${image}` : `${process.env.YUGIPEDIA_IMG}Back-TF-EN-VG.png`
    }

    return null
  }

  switch (prop) {
    case 'lore':
    case 'pendulum_effect':
    case 'requirement':
      return propValue
        .replace(/\[\[([^\]]+\|)([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replaceAll('<br />', ' ')
        .replaceAll("''", '"')
    case 'types':
      propValue = propValue.replaceAll(' / ', '/')
      return propValue
    case 'image':
      propValue = propValue.split('; ')
      if (propValue.length > 1) propValue = `${process.env.YUGIPEDIA_IMG}${propValue[1]}`
      else propValue = `${process.env.YUGIPEDIA_IMG}${propValue[0]}`
      
      return propValue
    case 'link_arrows':
      propValue = propValue.split(', ')
      return propValue
    default:
      return propValue
  }
}





module.exports = {
  fetchFromYugipedia
}