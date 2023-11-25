export const calculateWinnings = (wagerDetail, betState) => {
  try {

    const negThreeAndUnderPool: number = betState.negThreeAndUnderPool.toNumber();
    const negThreeToNegTwoPool: number = betState.negThreeToNegTwoPool.toNumber();
    const negTwoToNegOnePool: number = betState.negTwoToNegOnePool.toNumber();
    const negOneToZeroPool: number = betState.negOneToZeroPool.toNumber();
    const zeroToPosOnePool: number = betState.zeroToPosOnePool.toNumber();
    const posOneToPosTwoPool: number = betState.posOneToPosTwoPool.toNumber();
    const posTwoToPosThreePool: number = betState.posTwoToPosThreePool.toNumber();
    const posThreeAndOverPool: number = betState.posThreeAndOverPool.toNumber();

    const totalBetPool = [negThreeAndUnderPool, negThreeToNegTwoPool, negTwoToNegOnePool, negOneToZeroPool, zeroToPosOnePool, posOneToPosTwoPool, posTwoToPosThreePool, posThreeAndOverPool].reduce((partialSum, a) => partialSum + a, 0)

    const bettorsBetValue: number = wagerDetail.betValue.toNumber();

    let winnings: number;
    let poolLessTargetRange: number;

    if (wagerDetail.rangeStatus.hasOwnProperty('negThreeAndUnder')) {
      poolLessTargetRange = totalBetPool - negThreeAndUnderPool;
      winnings = calculateWinFromPoolDetails(bettorsBetValue, negThreeAndUnderPool, poolLessTargetRange);
    } else if(wagerDetail.rangeStatus.hasOwnProperty('negThreeToNegTwo')) {
      poolLessTargetRange = totalBetPool - negThreeToNegTwoPool;
      winnings = calculateWinFromPoolDetails(bettorsBetValue, negThreeToNegTwoPool, poolLessTargetRange);
    } else if(wagerDetail.rangeStatus.hasOwnProperty('negTwoToNegOne')) {
      poolLessTargetRange = totalBetPool - negTwoToNegOnePool;
      winnings = calculateWinFromPoolDetails(bettorsBetValue, negTwoToNegOnePool, poolLessTargetRange);
    } else if(wagerDetail.rangeStatus.hasOwnProperty('negOneToZero')) {
      poolLessTargetRange = totalBetPool - negOneToZeroPool;
      winnings = calculateWinFromPoolDetails(bettorsBetValue, negOneToZeroPool, poolLessTargetRange);
    } else if(wagerDetail.rangeStatus.hasOwnProperty('zeroToPosOne')) {
      poolLessTargetRange = totalBetPool - zeroToPosOnePool;
      winnings = calculateWinFromPoolDetails(bettorsBetValue, zeroToPosOnePool, poolLessTargetRange);
    } else if(wagerDetail.rangeStatus.hasOwnProperty('posOneToPosTwo')) {
      poolLessTargetRange = totalBetPool - posOneToPosTwoPool;
      winnings = calculateWinFromPoolDetails(bettorsBetValue, posOneToPosTwoPool, poolLessTargetRange);
    } else if(wagerDetail.rangeStatus.hasOwnProperty('posTwoToPosThree')) {
      poolLessTargetRange = totalBetPool - posTwoToPosThreePool;
      winnings = calculateWinFromPoolDetails(bettorsBetValue, posTwoToPosThreePool, poolLessTargetRange);
    } else if(wagerDetail.rangeStatus.hasOwnProperty('posThreeAndOver')) {
      poolLessTargetRange = totalBetPool - posThreeAndOverPool;
      winnings = calculateWinFromPoolDetails(bettorsBetValue, posThreeAndOverPool, poolLessTargetRange);
    } else {
      throw new Error("bettor does not belong to a valid party");
    }

    return winnings
    
  } catch (e) {

    throw e
    
  }

}

const calculateWinFromPoolDetails = (betValue: number, pool:number, totalBetPool: number): number => {
  const poolWeight = betValue/pool;
  const poolShare = poolWeight * totalBetPool;
  return (betValue + poolShare);
}

export const findWagerForUser = async (program, betState) => await program.account.bettorDetail.all([
  {
    memcmp: {
      offset: 8 + 32,
      bytes: betState.publicKey.toBase58(),
    }
  }
]);


// Bet State Functions

export const getAllBets = async (program) => await program.account.betState.all();

export const getSingleBet = async (program, betStateKP) => await program.account.betState.fetch(betStateKP.publicKey);


// Wager Functions

export const getAllWagersByUser = async (program) => await program.account.betState.all();

export const getOneWagerByUser = async (program, bettorDetailKP) => await program.account.betState.fetch(bettorDetailKP.publicKey);


// User Account Functions

export const getUserAccount = async (program, userKP) => await program.account.userAccount.all([
  {
    memcmp: {
      offset: 8,
      bytes: userKP.publicKey.toBase58(),
    }
  }
])

export const getUserWagers = async (userAccount) => {
  userAccount.activeWagers
}

export const matchingWagerFound = (program, userAccount, betStateKP) => {

  if (userAccount.activeWagers.length == 0) {
    return false
  }

  const matches = userAccount.activeWagers.map( async el => {
    const wager = await program.account.bettorDetail.fetch(el.toString())
    wager.betState.toString() == betStateKP.publicKey.toString()
  })

  if (matches.length > 0) {
    return true
  }

  return false
}

