import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { JuicyBets } from '../target/types/juicy_bets';
import assert from 'assert';
import { 
  calculateWinnings,
  findWagerForUser,
  matchingWagerFound
} from '../app/utils'

describe('juicy-bets', () => {

  // calls the anchor.Provider.env() method to generate a new Provider for us using our Anchor.toml config file
  // (it pulls from everything under the [provider] tag)
  // Cluster + Wallet = Provider
  anchor.setProvider(anchor.Provider.env()); 

  // Use that registered provider to create a new Program object that we can use in our tests
  const program = anchor.workspace.JuicyBets as Program<JuicyBets>;

  const providerWallet = program.provider.wallet

  const JUICED_BETS_TAKE_RATE = 1.02

  const TICKERS = ["TSLA/USD", "SPY/USD", "AAPL/USD"];


  // E2E Betting Tests //

  // GOOD
  it.skip('Initialize a Bet, Place a Wager, and Cancel a Wager', async () => {

    ///// ***** INITIALIZE BET FUNCTIONALITY ***** /////

    // Generate a new random keypair for betState
    const betStateKP = anchor.web3.Keypair.generate();

    const start = new anchor.BN(Date.now());
    const duration = new anchor.BN(5 * 60 * 1000);

    console.log("Starting the 'initialize bet state' functionality...");

    await program.rpc.initializeBetState(
      start,
      duration,
      'SPY',
      new anchor.BN(725.45 * 1000),
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers:[betStateKP]
      },
    )

    let betStateAccount = await program.account.betState.fetch(betStateKP.publicKey);

    console.log(`${JSON.stringify(betStateAccount)}`);

    assert.ok(betStateAccount);
    assert.ok(betStateAccount.staticTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.runningTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeAndUnderPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeToNegTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negTwoToNegOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negOneToZeroPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.zeroToPosOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posOneToPosTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posTwoToPosThreePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posThreeAndOverPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.status.hasOwnProperty("open"));
    assert.ok(betStateAccount.winningBetRange.hasOwnProperty("notAvailable"));




    // ///// ***** USER CREATES ACCOUNT ***** /////

    const bettorKP = anchor.web3.Keypair.generate();
    const bettor_airdrop_sig = await program.provider.connection.requestAirdrop(bettorKP.publicKey, 2000000000)
    await program.provider.connection.confirmTransaction(bettor_airdrop_sig, "finalized");

    const user1AccountKP = anchor.web3.Keypair.generate();

    console.log("Starting the 'initialize user account' functionality...");

    await program.rpc.initializeUserAccount({
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: bettorKP.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [bettorKP, user1AccountKP]
    })

    const userAccount = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    assert.ok(userAccount);
    console.log(`Bettor 1 User Account: ${JSON.stringify(userAccount)}`);
    assert.equal(userAccount.currentBalance.toNumber(), 0)
    assert.equal(userAccount.wins.toNumber(), 0)
    assert.equal(userAccount.losses.toNumber(), 0)




    ///// ***** USER DEPOSITS LAMPORTS INTO USER ACCOUNT ***** /////

    const lamports_to_deposit_num = LAMPORTS_PER_SOL * 1
    const lamports_to_deposit = new anchor.BN(LAMPORTS_PER_SOL * 1);

    console.log("Starting the 'deposit into user account' functionality...");

    await program.rpc.depositIntoAccount(lamports_to_deposit, {
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: bettorKP.publicKey
      },
      preInstructions: [
        await SystemProgram.transfer({
          fromPubkey: bettorKP.publicKey,
          lamports: lamports_to_deposit_num,
          toPubkey: user1AccountKP.publicKey
        })
      ],
      signers:[bettorKP]
    })

    const userAccountAfterDeposit = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    console.log(`Bettor 1 User Account After 1 Sol Deposit: ${JSON.stringify(userAccountAfterDeposit)}`);
    assert.equal(userAccountAfterDeposit.currentBalance.toNumber(), 1000000000);
    assert.equal(userAccountAfterDeposit.wins.toNumber(), 0);
    assert.equal(userAccountAfterDeposit.losses.toNumber(), 0);
    assert.equal(userAccountAfterDeposit.accountOwner.toString(), bettorKP.publicKey.toString());




    ///// ***** PLACE WAGER FUNCTIONALITY ***** /////

    const wagerDetail1KP = anchor.web3.Keypair.generate();
    const user1_bet_range_choice = 1;
    const user1_lamports_to_wager = new anchor.BN((LAMPORTS_PER_SOL * 0.5) * JUICED_BETS_TAKE_RATE);

    console.log(`Bet State lamports before first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`User Account lamports before first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    
    console.log("User 1 placing wager...");

    await program.rpc.placeWager(user1_bet_range_choice, user1_lamports_to_wager, {
      accounts: {
        betState: betStateKP.publicKey,
        wagerDetail: wagerDetail1KP.publicKey,
        userAccount: user1AccountKP.publicKey,
        bettorAccount: bettorKP.publicKey,
        betCreator: providerWallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [bettorKP, wagerDetail1KP]
    })

    const wagerDetailsAccount = await program.account.wagerDetail.fetch(wagerDetail1KP.publicKey);
    const betStateAfterFirstWager = await program.account.betState.fetch(betStateKP.publicKey);
    const userAccountAfterWager = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    // Test the newly created bettor detail account and associated changes
    assert.ok(wagerDetailsAccount);
    console.log(wagerDetailsAccount)
    assert.ok(wagerDetailsAccount.bettor.equals(bettorKP.publicKey), `The attached bettor address: ${wagerDetailsAccount.bettor.toString()} attached to this bettor detail does not match with the correct betting user address: ${bettorKP.publicKey.toString()}`);
    assert.ok(wagerDetailsAccount.betState.equals(betStateKP.publicKey), `The attached bet state: ${wagerDetailsAccount.betState.toString()} attached to this bettor detail does not match with the correct bet state: ${betStateKP.publicKey.toString()}`);
    assert.ok(wagerDetailsAccount.betValue.eq(new anchor.BN(user1_lamports_to_wager.toNumber()/JUICED_BETS_TAKE_RATE)), `Lamports we expect to bet: ${user1_lamports_to_wager} are not equal to the expected amount: ${wagerDetailsAccount.betValue.toNumber()}`);

    // Test the right number of lamports were transferred from user account to betState
    console.log(`User Account lamports after first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`Bettor 1 User Account Balance after wager: ${userAccountAfterWager.currentBalance.toNumber()/LAMPORTS_PER_SOL}`);
    assert.equal(userAccountAfterWager.activeWagers.length, 1);
    assert.equal(userAccountAfterWager.currentBalance.toNumber(), LAMPORTS_PER_SOL - user1_lamports_to_wager.toNumber());
    
    // Test the newly modified bet state obj with the updates from the placed wager
    console.log(`Bet state static total pool after first wager placement: ${betStateAfterFirstWager.staticTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state running total pool after first wager placement: ${betStateAfterFirstWager.runningTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeAndUnder pool after first wager placement: ${betStateAfterFirstWager.negThreeAndUnderPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeToNegTwo pool after first wager placement: ${betStateAfterFirstWager.negThreeToNegTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegTwoToNegOne pool after first wager placement: ${betStateAfterFirstWager.negTwoToNegOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegOneToZero pool after first wager placement: ${betStateAfterFirstWager.negOneToZeroPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state ZeroToPosOne pool after first wager placement: ${betStateAfterFirstWager.zeroToPosOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosOneToPosTwo pool after first wager placement: ${betStateAfterFirstWager.posOneToPosTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosTwoToPosThree pool after first wager placement: ${betStateAfterFirstWager.posTwoToPosThreePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosThreeAndOver pool after first wager placement: ${betStateAfterFirstWager.posThreeAndOverPool.toNumber()/LAMPORTS_PER_SOL}`);
    
    console.log(`Bet State lamports after first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)



    // ///// ***** CANCEL WAGER FUNCTIONALITY ***** /////

    console.log("Starting the 'cancel wager' functionality");

    await program.rpc.cancelWager(
      {
        accounts: {
          betState: betStateKP.publicKey,
          wagerDetail: wagerDetail1KP.publicKey,
          userAccount: user1AccountKP.publicKey,
          bettor: bettorKP.publicKey,
        },
        signers: [bettorKP]
      });


    const wagerDetailPAPostCancel = await program.account.wagerDetail.all([
      {
        memcmp: {
          offset: 8,
          bytes: bettorKP.publicKey.toBase58(),
        }
      }
    ]);

    const betStateAfterWagerCancellation = await program.account.betState.fetch(betStateKP.publicKey);
    const userAccountAfterWagerCancellation = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    // Test the cancel wager func
    assert.equal(wagerDetailPAPostCancel.length, 0);
    assert.ok(betStateAfterWagerCancellation.staticTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAfterWagerCancellation.runningTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAfterWagerCancellation.negThreeAndUnderPool.eq(new anchor.BN(0)));
    assert.ok(betStateAfterWagerCancellation.negThreeToNegTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAfterWagerCancellation.negTwoToNegOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAfterWagerCancellation.negOneToZeroPool.eq(new anchor.BN(0)));
    assert.ok(betStateAfterWagerCancellation.zeroToPosOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAfterWagerCancellation.posOneToPosTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAfterWagerCancellation.posTwoToPosThreePool.eq(new anchor.BN(0)));
    assert.ok(betStateAfterWagerCancellation.posThreeAndOverPool.eq(new anchor.BN(0)));
    assert.ok(betStateAfterWagerCancellation.status.hasOwnProperty("open"));
    assert.ok(betStateAfterWagerCancellation.winningBetRange.hasOwnProperty("notAvailable"));

    console.log(`Bet State lamports after cancellation: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`);
    console.log(`User Account lamports after cancellation: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`);

    console.log(`Bettor 1 User Account Balance after wager: ${userAccountAfterWagerCancellation.currentBalance.toNumber()/LAMPORTS_PER_SOL}`);
    assert.equal(userAccountAfterWagerCancellation.activeWagers.length, 0);
    assert.equal(userAccountAfterWagerCancellation.betsInvolved.length, 0);

  });
    
  // GOOD
  it('Initialize the bet, make three bets, bet is closed, and winnings participants can successfully claim their winnings, while losing participants can close out their losing wagers', async() => {

     ///// ***** INITIALIZE BET FUNCTIONALITY ***** /////

    // Generate a new random keypair for betState
    const betStateKP = anchor.web3.Keypair.generate();
    const start = new anchor.BN(Date.now());
    const duration = new anchor.BN(5 * 60 * 1000);

    console.log("Starting the 'initialize bet state' functionality...");
    console.log('--------------------')

    await program.rpc.initializeBetState(
      start,
      duration,
      'SPY',
      new anchor.BN(725.45 * 1000),
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers:[betStateKP]
      },
    )

    let betStateAccount = await program.account.betState.fetch(betStateKP.publicKey);

    await program.account.betState.all

    console.log(`${JSON.stringify(betStateAccount)}`);

    assert.ok(betStateAccount);
    assert.ok(betStateAccount.staticTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.runningTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeAndUnderPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeToNegTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negTwoToNegOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negOneToZeroPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.zeroToPosOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posOneToPosTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posTwoToPosThreePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posThreeAndOverPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.status.hasOwnProperty("open"));
    assert.ok(betStateAccount.winningBetRange.hasOwnProperty("notAvailable"));

    console.log('--------------------')
    console.log(`Bet Creator Sol Balance post bet init: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)



            ///// USER 1 /////




    ///// ***** USER 1 CREATES ACCOUNT ***** /////

    const user1KP = anchor.web3.Keypair.generate();
    const bettor1_airdrop_sig = await program.provider.connection.requestAirdrop(user1KP.publicKey, 2000000000)
    await program.provider.connection.confirmTransaction(bettor1_airdrop_sig, "finalized");

    const user1AccountKP = anchor.web3.Keypair.generate();

    console.log("Initializaing User 1 Account...");

    await program.rpc.initializeUserAccount({
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: user1KP.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user1KP, user1AccountKP]
    })

    const userAccount = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    assert.ok(userAccount);
    console.log(`Bettor 1 User Account: ${JSON.stringify(userAccount)}`);
    assert.equal(userAccount.currentBalance.toNumber(), 0)
    assert.equal(userAccount.wins.toNumber(), 0)
    assert.equal(userAccount.losses.toNumber(), 0)




    ///// ***** USER 1 DEPOSITS LAMPORTS INTO USER 1 ACCOUNT ***** /////

    const user1_lamports_to_deposit_num = LAMPORTS_PER_SOL * 1
    const user1_lamports_to_deposit = new anchor.BN(LAMPORTS_PER_SOL * 1);

    console.log("User 1 Depositing...");

    await program.rpc.depositIntoAccount(user1_lamports_to_deposit, {
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: user1KP.publicKey
      },
      preInstructions: [
        await SystemProgram.transfer({
          fromPubkey: user1KP.publicKey,
          lamports: user1_lamports_to_deposit_num,
          toPubkey: user1AccountKP.publicKey
        })
      ],
      signers:[user1KP]
    })

    const user1AccountAfterDeposit = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    console.log(`User 1 User Account After 1 Sol Deposit: ${JSON.stringify(user1AccountAfterDeposit)}`);
    assert.equal(user1AccountAfterDeposit.currentBalance.toNumber(), 1000000000);
    assert.equal(user1AccountAfterDeposit.wins.toNumber(), 0);
    assert.equal(user1AccountAfterDeposit.losses.toNumber(), 0);
    assert.equal(user1AccountAfterDeposit.accountOwner.toString(), user1KP.publicKey.toString());




    ///// ***** USER 1 PLACE WAGER FUNCTIONALITY ***** /////

    const wagerDetail1KP = anchor.web3.Keypair.generate();
    const user1_bet_range_choice = 1;
    const user1_lamports_to_wager = new anchor.BN((LAMPORTS_PER_SOL * 0.5) * JUICED_BETS_TAKE_RATE);

    console.log(`Bet State lamports before first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`User Account lamports before first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    
    console.log("User 1 placing wager...");

    await program.rpc.placeWager(user1_bet_range_choice, user1_lamports_to_wager, {
      accounts: {
        betState: betStateKP.publicKey,
        wagerDetail: wagerDetail1KP.publicKey,
        userAccount: user1AccountKP.publicKey,
        bettorAccount: user1KP.publicKey,
        betCreator: providerWallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user1KP, wagerDetail1KP]
    })

    const wagerDetails1Account = await program.account.wagerDetail.fetch(wagerDetail1KP.publicKey);
    const betStateAfterFirstWager = await program.account.betState.fetch(betStateKP.publicKey);
    const user1AccountAfterWager = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    // Test the newly created bettor detail account and associated changes
    assert.ok(wagerDetails1Account);
    console.log(wagerDetails1Account)
    assert.ok(wagerDetails1Account.bettor.equals(user1KP.publicKey), `The attached bettor address: ${wagerDetails1Account.bettor.toString()} attached to this bettor detail does not match with the correct betting user address: ${user1KP.publicKey.toString()}`);
    assert.ok(wagerDetails1Account.betState.equals(betStateKP.publicKey), `The attached bet state: ${wagerDetails1Account.betState.toString()} attached to this bettor detail does not match with the correct bet state: ${betStateKP.publicKey.toString()}`);
    assert.ok(wagerDetails1Account.betValue.eq(new anchor.BN(user1_lamports_to_wager.toNumber()/JUICED_BETS_TAKE_RATE)), `Lamports we expect to bet: ${user1_lamports_to_wager} are not equal to the expected amount: ${wagerDetails1Account.betValue.toNumber()}`);

    // Test the right number of lamports were transferred from user account to betState
    console.log(`User 1 Account lamports after first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`Bettor 1 User Account Balance after wager: ${user1AccountAfterWager.currentBalance.toNumber()/LAMPORTS_PER_SOL}`);
    console.log('--------------------')
    console.log(`Bet Creator Sol Balance after Bettor 1 places wager: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)
    assert.equal(user1AccountAfterWager.activeWagers.length, 1);
    
    // Test the newly modified bet state obj with the updates from the placed wager
    console.log(`Bet state static total pool after first wager placement: ${betStateAfterFirstWager.staticTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state running total pool after first wager placement: ${betStateAfterFirstWager.runningTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeAndUnder pool after first wager placement: ${betStateAfterFirstWager.negThreeAndUnderPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeToNegTwo pool after first wager placement: ${betStateAfterFirstWager.negThreeToNegTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegTwoToNegOne pool after first wager placement: ${betStateAfterFirstWager.negTwoToNegOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegOneToZero pool after first wager placement: ${betStateAfterFirstWager.negOneToZeroPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state ZeroToPosOne pool after first wager placement: ${betStateAfterFirstWager.zeroToPosOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosOneToPosTwo pool after first wager placement: ${betStateAfterFirstWager.posOneToPosTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosTwoToPosThree pool after first wager placement: ${betStateAfterFirstWager.posTwoToPosThreePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosThreeAndOver pool after first wager placement: ${betStateAfterFirstWager.posThreeAndOverPool.toNumber()/LAMPORTS_PER_SOL}`);
    
    console.log(`Bet State lamports after first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)





          ///// USER 2 /////




    ///// ***** USER 2 CREATES ACCOUNT ***** /////

    const user2KP = anchor.web3.Keypair.generate();
    const user2_airdrop_sig = await program.provider.connection.requestAirdrop(user2KP.publicKey, 2000000000)
    await program.provider.connection.confirmTransaction(user2_airdrop_sig, "finalized");

    const user2AccountKP = anchor.web3.Keypair.generate();

    console.log("Initializaing User 2 Account...");

    await program.rpc.initializeUserAccount({
      accounts: {
        userAccount: user2AccountKP.publicKey,
        accountOwner: user2KP.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user2KP, user2AccountKP]
    })

    const user2Account = await program.account.userAccount.fetch(user2AccountKP.publicKey);

    assert.ok(user2Account);
    console.log(`Bettor 2 User Account: ${JSON.stringify(user2Account)}`);
    assert.equal(user2Account.currentBalance.toNumber(), 0);
    assert.equal(user2Account.wins.toNumber(), 0);
    assert.equal(user2Account.losses.toNumber(), 0);




    ///// ***** USER 2 DEPOSITS LAMPORTS INTO USER 1 ACCOUNT ***** /////

    const user2_lamports_deposit_num = LAMPORTS_PER_SOL * 1
    const user2_lamports_to_deposit = new anchor.BN(LAMPORTS_PER_SOL * 1);

    console.log("User 2 Depositing...");

    await program.rpc.depositIntoAccount(user2_lamports_to_deposit, {
      accounts: {
        userAccount: user2AccountKP.publicKey,
        accountOwner: user2KP.publicKey
      },
      preInstructions: [
        await SystemProgram.transfer({
          fromPubkey: user2KP.publicKey,
          lamports: user2_lamports_deposit_num,
          toPubkey: user2AccountKP.publicKey
        })
      ],
      signers:[user2KP]
    })

    const user2AccountAfterDeposit = await program.account.userAccount.fetch(user2AccountKP.publicKey);

    console.log(`User 2 User Account After 1 Sol Deposit: ${JSON.stringify(user2AccountAfterDeposit)}`);
    assert.equal(user2AccountAfterDeposit.currentBalance.toNumber(), 1000000000);
    assert.equal(user2AccountAfterDeposit.wins.toNumber(), 0);
    assert.equal(user2AccountAfterDeposit.losses.toNumber(), 0);
    assert.equal(user2AccountAfterDeposit.accountOwner.toString(), user2KP.publicKey.toString());




    ///// ***** USER 2 PLACE WAGER FUNCTIONALITY ***** /////

    const wagerDetail2KP = anchor.web3.Keypair.generate();
    const user2_bet_range_choice = 1;
    const user2_lamports_to_wager = new anchor.BN((LAMPORTS_PER_SOL * 0.5) * JUICED_BETS_TAKE_RATE);

    console.log(`Bet State lamports before second wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`User 2 Account lamports before second wager placement: ${await program.provider.connection.getBalance(user2AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    
    console.log("User 2 placing wager...");

    await program.rpc.placeWager(user2_bet_range_choice, user2_lamports_to_wager, {
      accounts: {
        betState: betStateKP.publicKey,
        wagerDetail: wagerDetail2KP.publicKey,
        userAccount: user2AccountKP.publicKey,
        bettorAccount: user2KP.publicKey,
        betCreator: providerWallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user2KP, wagerDetail2KP]
    })

    const wagerDetails2Account = await program.account.wagerDetail.fetch(wagerDetail2KP.publicKey);
    const betStateAfterSecondWager = await program.account.betState.fetch(betStateKP.publicKey);
    const userAccount2AfterWager = await program.account.userAccount.fetch(user2AccountKP.publicKey);

    // Test the newly created bettor detail account and associated changes
    assert.ok(wagerDetails2Account);
    console.log(wagerDetails2Account)
    assert.ok(wagerDetails2Account.bettor.equals(user2KP.publicKey), `The attached bettor address: ${wagerDetails2Account.bettor.toString()} attached to this bettor detail does not match with the correct betting user address: ${user2KP.publicKey.toString()}`);
    assert.ok(wagerDetails2Account.betState.equals(betStateKP.publicKey), `The attached bet state: ${wagerDetails2Account.betState.toString()} attached to this bettor detail does not match with the correct bet state: ${betStateKP.publicKey.toString()}`);
    assert.ok(wagerDetails2Account.betValue.eq(new anchor.BN(user2_lamports_to_wager.toNumber()/JUICED_BETS_TAKE_RATE)), `Lamports we expect to bet: ${user2_lamports_to_wager} are not equal to the expected amount: ${wagerDetails2Account.betValue.toNumber()}`);

    // Test the right number of lamports were transferred from user account to betState
    console.log(`User 2 Account lamports after first wager placement: ${await program.provider.connection.getBalance(user2AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`Bettor 2 User Account Balance after wager: ${userAccount2AfterWager.currentBalance.toNumber()/LAMPORTS_PER_SOL}`);
    console.log('--------------------')
    console.log(`Bet Creator Sol Balance after Bettor 2 places wager: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)
    assert.equal(userAccount2AfterWager.activeWagers.length, 1);
    
    // Test the newly modified bet state obj with the updates from the placed wager
    console.log(`Bet state static total pool after second wager placement: ${betStateAfterSecondWager.staticTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state running total pool after second wager placement: ${betStateAfterSecondWager.runningTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeAndUnder pool after second wager placement: ${betStateAfterSecondWager.negThreeAndUnderPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeToNegTwo pool after second wager placement: ${betStateAfterSecondWager.negThreeToNegTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegTwoToNegOne pool after second wager placement: ${betStateAfterSecondWager.negTwoToNegOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegOneToZero pool after second wager placement: ${betStateAfterSecondWager.negOneToZeroPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state ZeroToPosOne pool after second wager placement: ${betStateAfterSecondWager.zeroToPosOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosOneToPosTwo pool after second wager placement: ${betStateAfterSecondWager.posOneToPosTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosTwoToPosThree pool after second wager placement: ${betStateAfterSecondWager.posTwoToPosThreePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosThreeAndOver pool after second wager placement: ${betStateAfterSecondWager.posThreeAndOverPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet State lamports after second wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)






          ///// USER 3 /////




    ///// ***** USER 3 CREATES ACCOUNT ***** /////

    const user3KP = anchor.web3.Keypair.generate();
    const user3_airdrop_sig = await program.provider.connection.requestAirdrop(user3KP.publicKey, 2000000000)
    await program.provider.connection.confirmTransaction(user3_airdrop_sig, "finalized");

    const user3AccountKP = anchor.web3.Keypair.generate();

    console.log("Initializaing User 3 Account...");

    await program.rpc.initializeUserAccount({
      accounts: {
        userAccount: user3AccountKP.publicKey,
        accountOwner: user3KP.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user3KP, user3AccountKP]
    })

    const user3Account = await program.account.userAccount.fetch(user3AccountKP.publicKey);

    assert.ok(user3Account);
    console.log(`Bettor 3 User Account: ${JSON.stringify(user3Account)}`);
    assert.equal(user3Account.currentBalance.toNumber(), 0)
    assert.equal(user3Account.wins.toNumber(), 0)
    assert.equal(user3Account.losses.toNumber(), 0)




    ///// ***** USER 3 DEPOSITS LAMPORTS INTO USER 1 ACCOUNT ***** /////

    const user3_lamports_deposit_num = LAMPORTS_PER_SOL * 1
    const user3_lamports_to_deposit = new anchor.BN(LAMPORTS_PER_SOL * 1);

    console.log("User 3 Depositing...");

    await program.rpc.depositIntoAccount(user3_lamports_to_deposit, {
      accounts: {
        userAccount: user3AccountKP.publicKey,
        accountOwner: user3KP.publicKey
      },
      preInstructions: [
        await SystemProgram.transfer({
          fromPubkey: user3KP.publicKey,
          lamports: user3_lamports_deposit_num,
          toPubkey: user3AccountKP.publicKey
        })
      ],
      signers:[user3KP]
    })

    const user3AccountAfterDeposit = await program.account.userAccount.fetch(user3AccountKP.publicKey);

    console.log(`User 3 User Account After 1 Sol Deposit: ${JSON.stringify(user3AccountAfterDeposit)}`);
    assert.equal(user3AccountAfterDeposit.currentBalance.toNumber(), 1000000000);
    assert.equal(user3AccountAfterDeposit.wins.toNumber(), 0);
    assert.equal(user3AccountAfterDeposit.losses.toNumber(), 0);
    assert.equal(user3AccountAfterDeposit.accountOwner.toString(), user3KP.publicKey.toString());




    ///// ***** USER 3 PLACE WAGER FUNCTIONALITY ***** /////

    const wagerDetail3KP = anchor.web3.Keypair.generate();
    const user3_bet_range_choice = 2;
    const user3_lamports_to_wager = new anchor.BN((LAMPORTS_PER_SOL * 0.5) * JUICED_BETS_TAKE_RATE);

    console.log(`Bet State lamports before third wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`User 3 Account lamports before third wager placement: ${await program.provider.connection.getBalance(user3AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    
    console.log("User 3 placing wager...");

    await program.rpc.placeWager(user3_bet_range_choice, user3_lamports_to_wager, {
      accounts: {
        betState: betStateKP.publicKey,
        wagerDetail: wagerDetail3KP.publicKey,
        userAccount: user3AccountKP.publicKey,
        bettorAccount: user3KP.publicKey,
        betCreator: providerWallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user3KP, wagerDetail3KP]
    })

    const wagerDetails3Account = await program.account.wagerDetail.fetch(wagerDetail3KP.publicKey);
    const betStateAfterThirdWager = await program.account.betState.fetch(betStateKP.publicKey);
    const userAccount3AfterWager = await program.account.userAccount.fetch(user3AccountKP.publicKey);

    // Test the newly created bettor detail account and associated changes
    assert.ok(wagerDetails3Account);
    console.log(wagerDetails3Account)
    assert.ok(wagerDetails3Account.bettor.equals(user3KP.publicKey), `The attached bettor address: ${wagerDetails3Account.bettor.toString()} attached to this bettor detail does not match with the correct betting user address: ${user3KP.publicKey.toString()}`);
    assert.ok(wagerDetails3Account.betState.equals(betStateKP.publicKey), `The attached bet state: ${wagerDetails3Account.betState.toString()} attached to this bettor detail does not match with the correct bet state: ${betStateKP.publicKey.toString()}`);
    assert.ok(wagerDetails3Account.betValue.eq(new anchor.BN(user3_lamports_to_wager.toNumber()/JUICED_BETS_TAKE_RATE)), `Lamports we expect to bet: ${user3_lamports_to_wager} are not equal to the expected amount: ${wagerDetails3Account.betValue.toNumber()}`);

    // Test the right number of lamports were transferred from user account to betState
    console.log(`User 3 Account lamports after third wager placement: ${await program.provider.connection.getBalance(user3AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`Bettor 3 User Account Balance after wager: ${userAccount3AfterWager.currentBalance.toNumber()/LAMPORTS_PER_SOL}`);
    console.log('--------------------')
    console.log(`Bet Creator Sol Balance after Bettor 3 places wager: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)
    assert.equal(userAccount3AfterWager.activeWagers.length, 1);
    
    // Test the newly modified bet state obj with the updates from the placed wager
    console.log(`Bet state static total pool after third wager placement: ${betStateAfterThirdWager.staticTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state running total pool after third wager placement: ${betStateAfterThirdWager.runningTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeAndUnder pool after third wager placement: ${betStateAfterThirdWager.negThreeAndUnderPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeToNegTwo pool after third wager placement: ${betStateAfterThirdWager.negThreeToNegTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegTwoToNegOne pool after third wager placement: ${betStateAfterThirdWager.negTwoToNegOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegOneToZero pool after third wager placement: ${betStateAfterThirdWager.negOneToZeroPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state ZeroToPosOne pool after third wager placement: ${betStateAfterThirdWager.zeroToPosOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosOneToPosTwo pool after third wager placement: ${betStateAfterThirdWager.posOneToPosTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosTwoToPosThree pool after third wager placement: ${betStateAfterThirdWager.posTwoToPosThreePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosThreeAndOver pool after third wager placement: ${betStateAfterThirdWager.posThreeAndOverPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet State lamports after third wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)




    ///// ***** CLOSING A BET STATE ***** /////

    const end_time = new anchor.BN(Date.now());

    const betStateBeforeClosing = await program.account.betState.fetch(betStateKP.publicKey);
    assert.ok(betStateBeforeClosing.status.hasOwnProperty("open"));

    await program.rpc.closeBetState(
      end_time,
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey
        }
      }
    )

    const betStateAfterClosing = await program.account.betState.fetch(betStateKP.publicKey);
    assert.ok(betStateAfterClosing);
    assert.ok(betStateAfterClosing.winningBetRange.hasOwnProperty("notAvailable"));
    assert.ok(betStateAfterClosing.status.hasOwnProperty("closed"));




    ///// ***** DECIDE THE BET STATE OUTCOME ***** /////

    await program.rpc.decideBetStateOutcome(
      1,
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey
        }
      }
    )

    const betStateAfterBetOutcomeDecided = await program.account.betState.fetch(betStateKP.publicKey);
    assert.ok(betStateAfterBetOutcomeDecided);
    console.log(`Bet state winnings bet range after 3 bets: ${JSON.stringify(betStateAfterBetOutcomeDecided.winningBetRange, null, 2)}`)
    assert.ok(betStateAfterBetOutcomeDecided.winningBetRange.hasOwnProperty("negThreeToNegTwo"));




    ///// ***** BETTOR FROM WINNING PARTY CAN CLAIM WINNINGS ***** /////

    /// BETTOR DETAIL INFO ///
    console.log("*****BETTOR DETAIL INFO*****");
    console.log(`Bettor Detail 1: ${wagerDetails1Account.bettor}`);
    console.log(`Bettor Detail 1 Bet: ${wagerDetails1Account.betValue}`);
    console.log(`Bettor Detail 2: ${wagerDetails2Account.bettor}`);
    console.log(`Bettor Detail 2 Bet: ${wagerDetails2Account.betValue}`);
    console.log(`Bettor Detail 3: ${wagerDetails3Account.bettor}`);
    console.log(`Bettor Detail 3 Bet: ${wagerDetails3Account.betValue}`);
     

    const bettor1Winnings = new anchor.BN(calculateWinnings(wagerDetails1Account, betStateAfterBetOutcomeDecided));
    const bettor2Winnings = new anchor.BN(calculateWinnings(wagerDetails2Account, betStateAfterBetOutcomeDecided));
    const bettor3Winnings = new anchor.BN(calculateWinnings(wagerDetails3Account, betStateAfterBetOutcomeDecided));

    console.log("*****CALCULATE WINNINGS FOR ALL THREE BETTORS*****")
    console.log(`Calculate winnings for Bettor 1: ${bettor1Winnings.toNumber()/LAMPORTS_PER_SOL} SOL`);
    console.log(`Calculate winnings for Bettor 2: ${bettor2Winnings.toNumber()/LAMPORTS_PER_SOL} SOL`);
    console.log(`Calculate winnings for Bettor 3: ${bettor3Winnings.toNumber()/LAMPORTS_PER_SOL} SOL`);

    console.log("*****PRE BETTOR 1 CLAIM STATE******");
    console.log(`Bet Creator Sol Balance `)
    console.log(`Bet State Sol Balance before Bettor 1 (Bet Creator) claims winnings: ${(await program.provider.connection.getBalance(betStateKP.publicKey))/LAMPORTS_PER_SOL} SOL`);
    console.log(`Bettor 1 (User 1) User Account Sol Balance Pre-Claim: ${(await program.provider.connection.getBalance(user1AccountKP.publicKey))/LAMPORTS_PER_SOL} SOL`);  
    console.log(`Bet State Account Static Total before Bettor 1 (User 1) claims winnings: ${betStateAfterBetOutcomeDecided.staticTotalPool.toNumber()/LAMPORTS_PER_SOL} SOL`);
    console.log(`Bet State Account Running Total before Bettor 1 (User 1) claims winnings: ${betStateAfterBetOutcomeDecided.runningTotalPool.toNumber()/LAMPORTS_PER_SOL} SOL`);




    ///// ***** USER 1 CLAIMS WINNINGS ***** /////

    // TODO: Abstract into utils
    await program.rpc.claimWinnings(
      bettor1Winnings,
      {
        accounts: {
          betState: betStateKP.publicKey,
          wagerDetail: wagerDetail1KP.publicKey,
          userAccount: user1AccountKP.publicKey,
          bettor: user1KP.publicKey
        },
        signers:[user1KP]
      }
    )

    const betStateAfterUser1Claims = await program.account.betState.fetch(betStateKP.publicKey);
    assert.ok(betStateAfterUser1Claims);

    console.log("*****POST BETTOR 1 CLAIM STATE******");
    console.log(`Bet State Sol Balance after Bettor 1 (User 1) claims winnings: ${(await program.provider.connection.getBalance(betStateKP.publicKey))/LAMPORTS_PER_SOL} SOL`);
    console.log(`Bettor 1 (User 1) User Account Sol Balance Post-Claim: ${(await program.provider.connection.getBalance(user1AccountKP.publicKey))/LAMPORTS_PER_SOL} SOL`);
    console.log(`Bet State Account Static Total after Bettor 1 (User 1) claims winnings: ${betStateAfterUser1Claims.staticTotalPool.toNumber()/LAMPORTS_PER_SOL} SOL`);
    console.log(`Bet State Account Running Total after Bettor 1 (User 1) claims winnings: ${betStateAfterUser1Claims.runningTotalPool.toNumber()/LAMPORTS_PER_SOL} SOL`);

    



    ///// ***** LAST BETTOR CLAIMS WINNINGS ***** /////

    await program.rpc.claimWinnings(
      bettor2Winnings,
      {
        accounts: {
          betState: betStateKP.publicKey,
          wagerDetail: wagerDetail2KP.publicKey,
          userAccount: user2AccountKP.publicKey,
          bettor: user2KP.publicKey
        },
        signers:[user2KP]
      }
    );

    const betStateAfterUser2Claims = await program.account.betState.fetch(betStateKP.publicKey);
    assert.ok(betStateAfterUser2Claims);

    console.log("*****POST FULLY CLAIMED BET STATE******");
    console.log(`Bet State Sol Balance after all winnings are claimed: ${(await program.provider.connection.getBalance(betStateKP.publicKey))/LAMPORTS_PER_SOL} SOL`);
    console.log(`Bettor 2 (User 2) User Account Sol Balance after all winnings are claimed: ${(await program.provider.connection.getBalance(user2AccountKP.publicKey))/LAMPORTS_PER_SOL} SOL`);
    console.log(`Bet State Account Static Total after all winnings are claimed: ${betStateAfterUser2Claims.staticTotalPool.toNumber()/LAMPORTS_PER_SOL} SOL`);
    console.log(`Bet State Account Running Total after all winnings are claimed: ${betStateAfterUser2Claims.runningTotalPool.toNumber()/LAMPORTS_PER_SOL} SOL`);




    ///// ***** LAST BETTOR CLAIMS WINNINGS ***** /////

    await program.rpc.closeLosingWager(
      {
        accounts: {
          betState: betStateKP.publicKey,
          wagerDetail: wagerDetail3KP.publicKey,
          userAccount: user3AccountKP.publicKey,
          bettor: user3KP.publicKey 
        },
        signers:[user3KP]
      }
    )

    const user1AccountPostClaim = await program.account.userAccount.fetch(user1AccountKP.publicKey);
    const user2AccountPostClaim = await program.account.userAccount.fetch(user2AccountKP.publicKey);
    const user3AccountPostClaim = await program.account.userAccount.fetch(user3AccountKP.publicKey);

    assert.equal(user1AccountPostClaim.activeWagers.length, 0);
    assert.equal(user2AccountPostClaim.activeWagers.length, 0);
    assert.equal(user3AccountPostClaim.activeWagers.length, 0);


    ///// ***** BET CREATOR SETTLES BET WHEN ALL WINNINGS ARE CLAIMED ***** /////

    await program.rpc.settleBetState(
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey,
        }
      }
    );

    const betStateToFindAfterBetStateSettles = await program.account.betState.all([
      {
        memcmp: {
          offset: 8,
          bytes: betStateKP.publicKey.toBase58(),
        }
      }
    ]);

    assert.equal(betStateToFindAfterBetStateSettles.length, 0);

  });


  // Placing Wagers //

  // GOOD
  it.skip('Cannot place a wager when the bet state is closed', async() => {

    ///// ***** INITIALIZE BET FUNCTIONALITY ***** /////

    // Generate a new random keypair for betState
    const betStateKP = anchor.web3.Keypair.generate();
    const start = new anchor.BN(Date.now());
    const duration = new anchor.BN(5 * 60 * 1000);

    console.log("Starting the 'initialize bet state' functionality...");
    console.log('--------------------')

    await program.rpc.initializeBetState(
      start,
      duration,
      'SPY',
      new anchor.BN(725.45 * 1000),
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers:[betStateKP]
      },
    )

    let betStateAccount = await program.account.betState.fetch(betStateKP.publicKey);

    await program.account.betState.all

    console.log(`${JSON.stringify(betStateAccount)}`);

    assert.ok(betStateAccount);
    assert.ok(betStateAccount.staticTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.runningTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeAndUnderPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeToNegTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negTwoToNegOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negOneToZeroPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.zeroToPosOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posOneToPosTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posTwoToPosThreePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posThreeAndOverPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.status.hasOwnProperty("open"));
    assert.ok(betStateAccount.winningBetRange.hasOwnProperty("notAvailable"));

    console.log('--------------------')
    console.log(`Bet Creator Sol Balance post bet init: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)



            ///// USER 1 /////




    ///// ***** USER 1 CREATES ACCOUNT ***** /////

    const user1KP = anchor.web3.Keypair.generate();
    const bettor1_airdrop_sig = await program.provider.connection.requestAirdrop(user1KP.publicKey, 2000000000)
    await program.provider.connection.confirmTransaction(bettor1_airdrop_sig, "finalized");

    const user1AccountKP = anchor.web3.Keypair.generate();

    console.log("Initializaing User 1 Account...");

    await program.rpc.initializeUserAccount({
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: user1KP.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user1KP, user1AccountKP]
    })

    const userAccount = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    assert.ok(userAccount);
    console.log(`Bettor 1 User Account: ${JSON.stringify(userAccount)}`);
    assert.equal(userAccount.currentBalance.toNumber(), 0)
    assert.equal(userAccount.wins.toNumber(), 0)
    assert.equal(userAccount.losses.toNumber(), 0)




    ///// ***** USER 1 DEPOSITS LAMPORTS INTO USER 1 ACCOUNT ***** /////

    const user1_lamports_to_deposit_num = LAMPORTS_PER_SOL * 1
    const user1_lamports_to_deposit = new anchor.BN(LAMPORTS_PER_SOL * 1);

    console.log("User 1 Depositing...");

    await program.rpc.depositIntoAccount(user1_lamports_to_deposit, {
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: user1KP.publicKey
      },
      preInstructions: [
        await SystemProgram.transfer({
          fromPubkey: user1KP.publicKey,
          lamports: user1_lamports_to_deposit_num,
          toPubkey: user1AccountKP.publicKey
        })
      ],
      signers:[user1KP]
    })

    const user1AccountAfterDeposit = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    console.log(`User 1 User Account After 1 Sol Deposit: ${JSON.stringify(user1AccountAfterDeposit)}`);
    assert.equal(user1AccountAfterDeposit.currentBalance.toNumber(), 1000000000);
    assert.equal(user1AccountAfterDeposit.wins.toNumber(), 0);
    assert.equal(user1AccountAfterDeposit.losses.toNumber(), 0);
    assert.equal(user1AccountAfterDeposit.accountOwner.toString(), user1KP.publicKey.toString());




    ///// ***** USER 1 PLACE WAGER FUNCTIONALITY ***** /////

    const wagerDetail1KP = anchor.web3.Keypair.generate();
    const user1_bet_range_choice = 1;
    const user1_lamports_to_wager = new anchor.BN((LAMPORTS_PER_SOL * 0.5) * JUICED_BETS_TAKE_RATE);

    console.log(`Bet State lamports before first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`User Account lamports before first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    
    console.log("User 1 placing wager...");

    await program.rpc.placeWager(user1_bet_range_choice, user1_lamports_to_wager, {
      accounts: {
        betState: betStateKP.publicKey,
        wagerDetail: wagerDetail1KP.publicKey,
        userAccount: user1AccountKP.publicKey,
        bettorAccount: user1KP.publicKey,
        betCreator: providerWallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user1KP, wagerDetail1KP]
    })

    const wagerDetails1Account = await program.account.wagerDetail.fetch(wagerDetail1KP.publicKey);
    const betStateAfterFirstWager = await program.account.betState.fetch(betStateKP.publicKey);
    const user1AccountAfterWager = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    // Test the newly created bettor detail account and associated changes
    assert.ok(wagerDetails1Account);
    console.log(wagerDetails1Account)
    assert.ok(wagerDetails1Account.bettor.equals(user1KP.publicKey), `The attached bettor address: ${wagerDetails1Account.bettor.toString()} attached to this bettor detail does not match with the correct betting user address: ${user1KP.publicKey.toString()}`);
    assert.ok(wagerDetails1Account.betState.equals(betStateKP.publicKey), `The attached bet state: ${wagerDetails1Account.betState.toString()} attached to this bettor detail does not match with the correct bet state: ${betStateKP.publicKey.toString()}`);
    assert.ok(wagerDetails1Account.betValue.eq(new anchor.BN(user1_lamports_to_wager.toNumber()/JUICED_BETS_TAKE_RATE)), `Lamports we expect to bet: ${user1_lamports_to_wager} are not equal to the expected amount: ${wagerDetails1Account.betValue.toNumber()}`);

    // Test the right number of lamports were transferred from user account to betState
    console.log(`User 1 Account lamports after first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`Bettor 1 User Account Balance after wager: ${user1AccountAfterWager.currentBalance.toNumber()/LAMPORTS_PER_SOL}`);
    console.log('--------------------')
    console.log(`Bet Creator Sol Balance after Bettor 1 places wager: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)
    assert.equal(user1AccountAfterWager.activeWagers.length, 1);
    
    // Test the newly modified bet state obj with the updates from the placed wager
    console.log(`Bet state static total pool after first wager placement: ${betStateAfterFirstWager.staticTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state running total pool after first wager placement: ${betStateAfterFirstWager.runningTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeAndUnder pool after first wager placement: ${betStateAfterFirstWager.negThreeAndUnderPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeToNegTwo pool after first wager placement: ${betStateAfterFirstWager.negThreeToNegTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegTwoToNegOne pool after first wager placement: ${betStateAfterFirstWager.negTwoToNegOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegOneToZero pool after first wager placement: ${betStateAfterFirstWager.negOneToZeroPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state ZeroToPosOne pool after first wager placement: ${betStateAfterFirstWager.zeroToPosOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosOneToPosTwo pool after first wager placement: ${betStateAfterFirstWager.posOneToPosTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosTwoToPosThree pool after first wager placement: ${betStateAfterFirstWager.posTwoToPosThreePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosThreeAndOver pool after first wager placement: ${betStateAfterFirstWager.posThreeAndOverPool.toNumber()/LAMPORTS_PER_SOL}`);
    
    console.log(`Bet State lamports after first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)


    ///// ***** CLOSING A BET STATE ***** /////

    const end_time = new anchor.BN(Date.now());

    const betStateBeforeClosing = await program.account.betState.fetch(betStateKP.publicKey);
    assert.ok(betStateBeforeClosing.status.hasOwnProperty("open"));

    await program.rpc.closeBetState(
      end_time,
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey
        }
      }
    )

    const betStateAfterClosing = await program.account.betState.fetch(betStateKP.publicKey);
    assert.ok(betStateAfterClosing);
    assert.ok(betStateAfterClosing.winningBetRange.hasOwnProperty("notAvailable"));
    assert.ok(betStateAfterClosing.status.hasOwnProperty("closed"));

    try {

      ///// ***** USER 2 CREATES ACCOUNT ***** /////

      const user2KP = anchor.web3.Keypair.generate();
      const user2_airdrop_sig = await program.provider.connection.requestAirdrop(user2KP.publicKey, 2000000000)
      await program.provider.connection.confirmTransaction(user2_airdrop_sig, "finalized");

      const user2AccountKP = anchor.web3.Keypair.generate();

      console.log("Initializaing User 2 Account...");

      await program.rpc.initializeUserAccount({
        accounts: {
          userAccount: user2AccountKP.publicKey,
          accountOwner: user2KP.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers: [user2KP, user2AccountKP]
      })

      const user2Account = await program.account.userAccount.fetch(user2AccountKP.publicKey);

      assert.ok(user2Account);
      console.log(`Bettor 2 User Account: ${JSON.stringify(user2Account)}`);
      assert.equal(user2Account.currentBalance.toNumber(), 0);
      assert.equal(user2Account.wins.toNumber(), 0);
      assert.equal(user2Account.losses.toNumber(), 0);




      ///// ***** USER 2 DEPOSITS LAMPORTS INTO USER 1 ACCOUNT ***** /////

      const user2_lamports_deposit_num = LAMPORTS_PER_SOL * 1
      const user2_lamports_to_deposit = new anchor.BN(LAMPORTS_PER_SOL * 1);

      console.log("User 2 Depositing...");

      await program.rpc.depositIntoAccount(user2_lamports_to_deposit, {
        accounts: {
          userAccount: user2AccountKP.publicKey,
          accountOwner: user2KP.publicKey
        },
        preInstructions: [
          await SystemProgram.transfer({
            fromPubkey: user2KP.publicKey,
            lamports: user2_lamports_deposit_num,
            toPubkey: user2AccountKP.publicKey
          })
        ],
        signers:[user2KP]
      })

      const user2AccountAfterDeposit = await program.account.userAccount.fetch(user2AccountKP.publicKey);

      console.log(`User 2 User Account After 1 Sol Deposit: ${JSON.stringify(user2AccountAfterDeposit)}`);
      assert.equal(user2AccountAfterDeposit.currentBalance.toNumber(), 1000000000);
      assert.equal(user2AccountAfterDeposit.wins.toNumber(), 0);
      assert.equal(user2AccountAfterDeposit.losses.toNumber(), 0);
      assert.equal(user2AccountAfterDeposit.accountOwner.toString(), user2KP.publicKey.toString());




      ///// ***** USER 2 PLACE WAGER FUNCTIONALITY ***** /////

      const wagerDetail2KP = anchor.web3.Keypair.generate();
      const user2_bet_range_choice = 1;
      const user2_lamports_to_wager = new anchor.BN((LAMPORTS_PER_SOL * 0.5) * JUICED_BETS_TAKE_RATE);

      console.log(`Bet State lamports before second wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)
      console.log(`User 2 Account lamports before second wager placement: ${await program.provider.connection.getBalance(user2AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
      
      console.log("User 2 placing wager...");

      await program.rpc.placeWager(user2_bet_range_choice, user2_lamports_to_wager, {
        accounts: {
          betState: betStateKP.publicKey,
          wagerDetail: wagerDetail2KP.publicKey,
          userAccount: user2AccountKP.publicKey,
          bettorAccount: user2KP.publicKey,
          betCreator: providerWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers: [user2KP, wagerDetail2KP]
      })

      
    } catch (error) {
      assert.equal(error, 'Cannot carry out this action when the bet is closed or is already settled.');
      return;
    }

  });


  // Settling Bets //

  // GOOD
  it.skip('Cannot settle a bet when any range pool has > 0 funds in its pool', async() => {
  
    ///// ***** INITIALIZE BET FUNCTIONALITY ***** /////

    // Generate a new random keypair for betState
    const betStateKP = anchor.web3.Keypair.generate();
    const start = new anchor.BN(Date.now());
    const duration = new anchor.BN(5 * 60 * 1000);

    console.log("Starting the 'initialize bet state' functionality...");
    console.log('--------------------')

    await program.rpc.initializeBetState(
      start,
      duration,
      'SPY',
      new anchor.BN(725.45 * 1000),
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers:[betStateKP]
      },
    )

    let betStateAccount = await program.account.betState.fetch(betStateKP.publicKey);

    await program.account.betState.all

    console.log(`${JSON.stringify(betStateAccount)}`);

    assert.ok(betStateAccount);
    assert.ok(betStateAccount.staticTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.runningTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeAndUnderPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeToNegTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negTwoToNegOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negOneToZeroPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.zeroToPosOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posOneToPosTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posTwoToPosThreePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posThreeAndOverPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.status.hasOwnProperty("open"));
    assert.ok(betStateAccount.winningBetRange.hasOwnProperty("notAvailable"));

    console.log('--------------------')
    console.log(`Bet Creator Sol Balance post bet init: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)



            ///// USER 1 /////




    ///// ***** USER 1 CREATES ACCOUNT ***** /////

    const user1KP = anchor.web3.Keypair.generate();
    const bettor1_airdrop_sig = await program.provider.connection.requestAirdrop(user1KP.publicKey, 2000000000)
    await program.provider.connection.confirmTransaction(bettor1_airdrop_sig, "finalized");

    const user1AccountKP = anchor.web3.Keypair.generate();

    console.log("Initializaing User 1 Account...");

    await program.rpc.initializeUserAccount({
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: user1KP.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user1KP, user1AccountKP]
    })

    const userAccount = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    assert.ok(userAccount);
    console.log(`Bettor 1 User Account: ${JSON.stringify(userAccount)}`);
    assert.equal(userAccount.currentBalance.toNumber(), 0)
    assert.equal(userAccount.wins.toNumber(), 0)
    assert.equal(userAccount.losses.toNumber(), 0)




    ///// ***** USER 1 DEPOSITS LAMPORTS INTO USER 1 ACCOUNT ***** /////

    const user1_lamports_to_deposit_num = LAMPORTS_PER_SOL * 1
    const user1_lamports_to_deposit = new anchor.BN(LAMPORTS_PER_SOL * 1);

    console.log("User 1 Depositing...");

    await program.rpc.depositIntoAccount(user1_lamports_to_deposit, {
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: user1KP.publicKey
      },
      preInstructions: [
        await SystemProgram.transfer({
          fromPubkey: user1KP.publicKey,
          lamports: user1_lamports_to_deposit_num,
          toPubkey: user1AccountKP.publicKey
        })
      ],
      signers:[user1KP]
    })

    const user1AccountAfterDeposit = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    console.log(`User 1 User Account After 1 Sol Deposit: ${JSON.stringify(user1AccountAfterDeposit)}`);
    assert.equal(user1AccountAfterDeposit.currentBalance.toNumber(), 1000000000);
    assert.equal(user1AccountAfterDeposit.wins.toNumber(), 0);
    assert.equal(user1AccountAfterDeposit.losses.toNumber(), 0);
    assert.equal(user1AccountAfterDeposit.accountOwner.toString(), user1KP.publicKey.toString());




    ///// ***** USER 1 PLACE WAGER FUNCTIONALITY ***** /////

    const wagerDetail1KP = anchor.web3.Keypair.generate();
    const user1_bet_range_choice = 1;
    const user1_lamports_to_wager = new anchor.BN((LAMPORTS_PER_SOL * 0.5) * JUICED_BETS_TAKE_RATE);

    console.log(`Bet State lamports before first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`User Account lamports before first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    
    console.log("User 1 placing wager...");

    await program.rpc.placeWager(user1_bet_range_choice, user1_lamports_to_wager, {
      accounts: {
        betState: betStateKP.publicKey,
        wagerDetail: wagerDetail1KP.publicKey,
        userAccount: user1AccountKP.publicKey,
        bettorAccount: user1KP.publicKey,
        betCreator: providerWallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user1KP, wagerDetail1KP]
    })

    const wagerDetails1Account = await program.account.wagerDetail.fetch(wagerDetail1KP.publicKey);
    const betStateAfterFirstWager = await program.account.betState.fetch(betStateKP.publicKey);
    const user1AccountAfterWager = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    // Test the newly created bettor detail account and associated changes
    assert.ok(wagerDetails1Account);
    console.log(wagerDetails1Account)
    assert.ok(wagerDetails1Account.bettor.equals(user1KP.publicKey), `The attached bettor address: ${wagerDetails1Account.bettor.toString()} attached to this bettor detail does not match with the correct betting user address: ${user1KP.publicKey.toString()}`);
    assert.ok(wagerDetails1Account.betState.equals(betStateKP.publicKey), `The attached bet state: ${wagerDetails1Account.betState.toString()} attached to this bettor detail does not match with the correct bet state: ${betStateKP.publicKey.toString()}`);
    assert.ok(wagerDetails1Account.betValue.eq(new anchor.BN(user1_lamports_to_wager.toNumber()/JUICED_BETS_TAKE_RATE)), `Lamports we expect to bet: ${user1_lamports_to_wager} are not equal to the expected amount: ${wagerDetails1Account.betValue.toNumber()}`);

    // Test the right number of lamports were transferred from user account to betState
    console.log(`User 1 Account lamports after first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`Bettor 1 User Account Balance after wager: ${user1AccountAfterWager.currentBalance.toNumber()/LAMPORTS_PER_SOL}`);
    console.log('--------------------')
    console.log(`Bet Creator Sol Balance after Bettor 1 places wager: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)
    assert.equal(user1AccountAfterWager.activeWagers.length, 1);
    
    // Test the newly modified bet state obj with the updates from the placed wager
    console.log(`Bet state static total pool after first wager placement: ${betStateAfterFirstWager.staticTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state running total pool after first wager placement: ${betStateAfterFirstWager.runningTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeAndUnder pool after first wager placement: ${betStateAfterFirstWager.negThreeAndUnderPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeToNegTwo pool after first wager placement: ${betStateAfterFirstWager.negThreeToNegTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegTwoToNegOne pool after first wager placement: ${betStateAfterFirstWager.negTwoToNegOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegOneToZero pool after first wager placement: ${betStateAfterFirstWager.negOneToZeroPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state ZeroToPosOne pool after first wager placement: ${betStateAfterFirstWager.zeroToPosOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosOneToPosTwo pool after first wager placement: ${betStateAfterFirstWager.posOneToPosTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosTwoToPosThree pool after first wager placement: ${betStateAfterFirstWager.posTwoToPosThreePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosThreeAndOver pool after first wager placement: ${betStateAfterFirstWager.posThreeAndOverPool.toNumber()/LAMPORTS_PER_SOL}`);
    
    console.log(`Bet State lamports after first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)


    ///// ***** CLOSING A BET STATE ***** /////

    const end_time = new anchor.BN(Date.now());

    const betStateBeforeClosing = await program.account.betState.fetch(betStateKP.publicKey);
    assert.ok(betStateBeforeClosing.status.hasOwnProperty("open"));

    await program.rpc.closeBetState(
      end_time,
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey
        }
      }
    )

    const betStateAfterClosing = await program.account.betState.fetch(betStateKP.publicKey);
    assert.ok(betStateAfterClosing);
    assert.ok(betStateAfterClosing.winningBetRange.hasOwnProperty("notAvailable"));
    assert.ok(betStateAfterClosing.status.hasOwnProperty("closed"));


    ///// ***** DECIDE THE BET STATE OUTCOME ***** /////

    await program.rpc.decideBetStateOutcome(
      1,
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey
        }
      }
    )


    ///// ***** SETTLE BET FUNCTIONALITY ***** //////
    try {
      await program.rpc.settleBetState(
        {
          accounts: {
            betState: betStateKP.publicKey,
            betCreator: providerWallet.publicKey,
          }
        }
      );
    } catch (error) {
      assert.equal(error,'Cannot carry out this action until all funds are withdrawn.');
      return;
    }

  });


  // Claiming Winnings //

  // GOOD
  it.skip('Cannot claim winnings when the bet state outcome is still open', async() => {

    ///// ***** INITIALIZE BET FUNCTIONALITY ***** /////

    // Generate a new random keypair for betState
    const betStateKP = anchor.web3.Keypair.generate();
    const start = new anchor.BN(Date.now());
    const duration = new anchor.BN(5 * 60 * 1000);

    console.log("Starting the 'initialize bet state' functionality...");
    console.log('--------------------')

    await program.rpc.initializeBetState(
      start,
      duration,
      'SPY',
      new anchor.BN(725.45 * 1000),
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers:[betStateKP]
      },
    )

    let betStateAccount = await program.account.betState.fetch(betStateKP.publicKey);

    await program.account.betState.all

    console.log(`${JSON.stringify(betStateAccount)}`);

    assert.ok(betStateAccount);
    assert.ok(betStateAccount.staticTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.runningTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeAndUnderPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeToNegTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negTwoToNegOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negOneToZeroPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.zeroToPosOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posOneToPosTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posTwoToPosThreePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posThreeAndOverPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.status.hasOwnProperty("open"));
    assert.ok(betStateAccount.winningBetRange.hasOwnProperty("notAvailable"));

    console.log('--------------------')
    console.log(`Bet Creator Sol Balance post bet init: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)



            ///// USER 1 /////




    ///// ***** USER 1 CREATES ACCOUNT ***** /////

    const user1KP = anchor.web3.Keypair.generate();
    const bettor1_airdrop_sig = await program.provider.connection.requestAirdrop(user1KP.publicKey, 2000000000)
    await program.provider.connection.confirmTransaction(bettor1_airdrop_sig, "finalized");

    const user1AccountKP = anchor.web3.Keypair.generate();

    console.log("Initializaing User 1 Account...");

    await program.rpc.initializeUserAccount({
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: user1KP.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user1KP, user1AccountKP]
    })

    const userAccount = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    assert.ok(userAccount);
    console.log(`Bettor 1 User Account: ${JSON.stringify(userAccount)}`);
    assert.equal(userAccount.currentBalance.toNumber(), 0)
    assert.equal(userAccount.wins.toNumber(), 0)
    assert.equal(userAccount.losses.toNumber(), 0)




    ///// ***** USER 1 DEPOSITS LAMPORTS INTO USER 1 ACCOUNT ***** /////

    const user1_lamports_to_deposit_num = LAMPORTS_PER_SOL * 1
    const user1_lamports_to_deposit = new anchor.BN(LAMPORTS_PER_SOL * 1);

    console.log("User 1 Depositing...");

    await program.rpc.depositIntoAccount(user1_lamports_to_deposit, {
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: user1KP.publicKey
      },
      preInstructions: [
        await SystemProgram.transfer({
          fromPubkey: user1KP.publicKey,
          lamports: user1_lamports_to_deposit_num,
          toPubkey: user1AccountKP.publicKey
        })
      ],
      signers:[user1KP]
    })

    const user1AccountAfterDeposit = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    console.log(`User 1 User Account After 1 Sol Deposit: ${JSON.stringify(user1AccountAfterDeposit)}`);
    assert.equal(user1AccountAfterDeposit.currentBalance.toNumber(), 1000000000);
    assert.equal(user1AccountAfterDeposit.wins.toNumber(), 0);
    assert.equal(user1AccountAfterDeposit.losses.toNumber(), 0);
    assert.equal(user1AccountAfterDeposit.accountOwner.toString(), user1KP.publicKey.toString());




    ///// ***** USER 1 PLACE WAGER FUNCTIONALITY ***** /////

    const wagerDetail1KP = anchor.web3.Keypair.generate();
    const user1_bet_range_choice = 1;
    const user1_lamports_to_wager = new anchor.BN((LAMPORTS_PER_SOL * 0.5) * JUICED_BETS_TAKE_RATE);

    console.log(`Bet State lamports before first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`User Account lamports before first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    
    console.log("User 1 placing wager...");

    await program.rpc.placeWager(user1_bet_range_choice, user1_lamports_to_wager, {
      accounts: {
        betState: betStateKP.publicKey,
        wagerDetail: wagerDetail1KP.publicKey,
        userAccount: user1AccountKP.publicKey,
        bettorAccount: user1KP.publicKey,
        betCreator: providerWallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user1KP, wagerDetail1KP]
    })

    const wagerDetails1Account = await program.account.wagerDetail.fetch(wagerDetail1KP.publicKey);
    const betStateAfterFirstWager = await program.account.betState.fetch(betStateKP.publicKey);
    const user1AccountAfterWager = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    // Test the newly created bettor detail account and associated changes
    assert.ok(wagerDetails1Account);
    console.log(wagerDetails1Account)
    assert.ok(wagerDetails1Account.bettor.equals(user1KP.publicKey), `The attached bettor address: ${wagerDetails1Account.bettor.toString()} attached to this bettor detail does not match with the correct betting user address: ${user1KP.publicKey.toString()}`);
    assert.ok(wagerDetails1Account.betState.equals(betStateKP.publicKey), `The attached bet state: ${wagerDetails1Account.betState.toString()} attached to this bettor detail does not match with the correct bet state: ${betStateKP.publicKey.toString()}`);
    assert.ok(wagerDetails1Account.betValue.eq(new anchor.BN(user1_lamports_to_wager.toNumber()/JUICED_BETS_TAKE_RATE)), `Lamports we expect to bet: ${user1_lamports_to_wager} are not equal to the expected amount: ${wagerDetails1Account.betValue.toNumber()}`);

    // Test the right number of lamports were transferred from user account to betState
    console.log(`User 1 Account lamports after first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`Bettor 1 User Account Balance after wager: ${user1AccountAfterWager.currentBalance.toNumber()/LAMPORTS_PER_SOL}`);
    console.log('--------------------')
    console.log(`Bet Creator Sol Balance after Bettor 1 places wager: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)
    assert.equal(user1AccountAfterWager.activeWagers.length, 1);
    
    // Test the newly modified bet state obj with the updates from the placed wager
    console.log(`Bet state static total pool after first wager placement: ${betStateAfterFirstWager.staticTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state running total pool after first wager placement: ${betStateAfterFirstWager.runningTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeAndUnder pool after first wager placement: ${betStateAfterFirstWager.negThreeAndUnderPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeToNegTwo pool after first wager placement: ${betStateAfterFirstWager.negThreeToNegTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegTwoToNegOne pool after first wager placement: ${betStateAfterFirstWager.negTwoToNegOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegOneToZero pool after first wager placement: ${betStateAfterFirstWager.negOneToZeroPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state ZeroToPosOne pool after first wager placement: ${betStateAfterFirstWager.zeroToPosOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosOneToPosTwo pool after first wager placement: ${betStateAfterFirstWager.posOneToPosTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosTwoToPosThree pool after first wager placement: ${betStateAfterFirstWager.posTwoToPosThreePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosThreeAndOver pool after first wager placement: ${betStateAfterFirstWager.posThreeAndOverPool.toNumber()/LAMPORTS_PER_SOL}`);
    
    console.log(`Bet State lamports after first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)


    const bettor1Winnings = new anchor.BN(calculateWinnings(wagerDetails1Account, betStateAfterFirstWager));



    ///// ***** CLAIM WINNINGS ***** /////

    try {

      ///// ***** USER 1 CLAIMS WINNINGS ***** /////

      await program.rpc.claimWinnings(
        bettor1Winnings,
        {
          accounts: {
            betState: betStateKP.publicKey,
            wagerDetail: wagerDetail1KP.publicKey,
            userAccount: user1AccountKP.publicKey,
            bettor: user1KP.publicKey
          },
          signers:[user1KP]
        }
      )
      
    } catch (error) {
      assert.equal(error.msg, 'Cannot carry out this action while the bet is still open.');
      return;
    }
    
  });

  // GOOD
  it.skip('Cannot claim winnings when the bet state outcome is closed, but still undecided', async() => {

    ///// ***** INITIALIZE BET FUNCTIONALITY ***** /////

    // Generate a new random keypair for betState
    const betStateKP = anchor.web3.Keypair.generate();
    const start = new anchor.BN(Date.now());
    const duration = new anchor.BN(5 * 60 * 1000);

    console.log("Starting the 'initialize bet state' functionality...");
    console.log('--------------------')

    await program.rpc.initializeBetState(
      start,
      duration,
      'SPY',
      new anchor.BN(725.45 * 1000),
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers:[betStateKP]
      },
    )

    let betStateAccount = await program.account.betState.fetch(betStateKP.publicKey);

    await program.account.betState.all

    console.log(`${JSON.stringify(betStateAccount)}`);

    assert.ok(betStateAccount);
    assert.ok(betStateAccount.staticTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.runningTotalPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeAndUnderPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negThreeToNegTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negTwoToNegOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.negOneToZeroPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.zeroToPosOnePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posOneToPosTwoPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posTwoToPosThreePool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.posThreeAndOverPool.eq(new anchor.BN(0)));
    assert.ok(betStateAccount.status.hasOwnProperty("open"));
    assert.ok(betStateAccount.winningBetRange.hasOwnProperty("notAvailable"));

    console.log('--------------------')
    console.log(`Bet Creator Sol Balance post bet init: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)



            ///// USER 1 /////




    ///// ***** USER 1 CREATES ACCOUNT ***** /////

    const user1KP = anchor.web3.Keypair.generate();
    const bettor1_airdrop_sig = await program.provider.connection.requestAirdrop(user1KP.publicKey, 2000000000)
    await program.provider.connection.confirmTransaction(bettor1_airdrop_sig, "finalized");

    const user1AccountKP = anchor.web3.Keypair.generate();

    console.log("Initializaing User 1 Account...");

    await program.rpc.initializeUserAccount({
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: user1KP.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user1KP, user1AccountKP]
    })

    const userAccount = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    assert.ok(userAccount);
    console.log(`Bettor 1 User Account: ${JSON.stringify(userAccount)}`);
    assert.equal(userAccount.currentBalance.toNumber(), 0)
    assert.equal(userAccount.wins.toNumber(), 0)
    assert.equal(userAccount.losses.toNumber(), 0)




    ///// ***** USER 1 DEPOSITS LAMPORTS INTO USER 1 ACCOUNT ***** /////

    const user1_lamports_to_deposit_num = LAMPORTS_PER_SOL * 1
    const user1_lamports_to_deposit = new anchor.BN(LAMPORTS_PER_SOL * 1);

    console.log("User 1 Depositing...");

    await program.rpc.depositIntoAccount(user1_lamports_to_deposit, {
      accounts: {
        userAccount: user1AccountKP.publicKey,
        accountOwner: user1KP.publicKey
      },
      preInstructions: [
        await SystemProgram.transfer({
          fromPubkey: user1KP.publicKey,
          lamports: user1_lamports_to_deposit_num,
          toPubkey: user1AccountKP.publicKey
        })
      ],
      signers:[user1KP]
    })

    const user1AccountAfterDeposit = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    console.log(`User 1 User Account After 1 Sol Deposit: ${JSON.stringify(user1AccountAfterDeposit)}`);
    assert.equal(user1AccountAfterDeposit.currentBalance.toNumber(), 1000000000);
    assert.equal(user1AccountAfterDeposit.wins.toNumber(), 0);
    assert.equal(user1AccountAfterDeposit.losses.toNumber(), 0);
    assert.equal(user1AccountAfterDeposit.accountOwner.toString(), user1KP.publicKey.toString());




    ///// ***** USER 1 PLACE WAGER FUNCTIONALITY ***** /////

    const wagerDetail1KP = anchor.web3.Keypair.generate();
    const user1_bet_range_choice = 1;
    const user1_lamports_to_wager = new anchor.BN((LAMPORTS_PER_SOL * 0.5) * JUICED_BETS_TAKE_RATE);

    console.log(`Bet State lamports before first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`User Account lamports before first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    
    console.log("User 1 placing wager...");

    await program.rpc.placeWager(user1_bet_range_choice, user1_lamports_to_wager, {
      accounts: {
        betState: betStateKP.publicKey,
        wagerDetail: wagerDetail1KP.publicKey,
        userAccount: user1AccountKP.publicKey,
        bettorAccount: user1KP.publicKey,
        betCreator: providerWallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [user1KP, wagerDetail1KP]
    })

    const wagerDetails1Account = await program.account.wagerDetail.fetch(wagerDetail1KP.publicKey);
    const betStateAfterFirstWager = await program.account.betState.fetch(betStateKP.publicKey);
    const user1AccountAfterWager = await program.account.userAccount.fetch(user1AccountKP.publicKey);

    // Test the newly created bettor detail account and associated changes
    assert.ok(wagerDetails1Account);
    console.log(wagerDetails1Account)
    assert.ok(wagerDetails1Account.bettor.equals(user1KP.publicKey), `The attached bettor address: ${wagerDetails1Account.bettor.toString()} attached to this bettor detail does not match with the correct betting user address: ${user1KP.publicKey.toString()}`);
    assert.ok(wagerDetails1Account.betState.equals(betStateKP.publicKey), `The attached bet state: ${wagerDetails1Account.betState.toString()} attached to this bettor detail does not match with the correct bet state: ${betStateKP.publicKey.toString()}`);
    assert.ok(wagerDetails1Account.betValue.eq(new anchor.BN(user1_lamports_to_wager.toNumber()/JUICED_BETS_TAKE_RATE)), `Lamports we expect to bet: ${user1_lamports_to_wager} are not equal to the expected amount: ${wagerDetails1Account.betValue.toNumber()}`);

    // Test the right number of lamports were transferred from user account to betState
    console.log(`User 1 Account lamports after first wager placement: ${await program.provider.connection.getBalance(user1AccountKP.publicKey)/LAMPORTS_PER_SOL}`)
    console.log(`Bettor 1 User Account Balance after wager: ${user1AccountAfterWager.currentBalance.toNumber()/LAMPORTS_PER_SOL}`);
    console.log('--------------------')
    console.log(`Bet Creator Sol Balance after Bettor 1 places wager: ${await program.provider.connection.getBalance(providerWallet.publicKey)/LAMPORTS_PER_SOL}`)
    assert.equal(user1AccountAfterWager.activeWagers.length, 1);
    
    // Test the newly modified bet state obj with the updates from the placed wager
    console.log(`Bet state static total pool after first wager placement: ${betStateAfterFirstWager.staticTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state running total pool after first wager placement: ${betStateAfterFirstWager.runningTotalPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeAndUnder pool after first wager placement: ${betStateAfterFirstWager.negThreeAndUnderPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegThreeToNegTwo pool after first wager placement: ${betStateAfterFirstWager.negThreeToNegTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegTwoToNegOne pool after first wager placement: ${betStateAfterFirstWager.negTwoToNegOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state NegOneToZero pool after first wager placement: ${betStateAfterFirstWager.negOneToZeroPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state ZeroToPosOne pool after first wager placement: ${betStateAfterFirstWager.zeroToPosOnePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosOneToPosTwo pool after first wager placement: ${betStateAfterFirstWager.posOneToPosTwoPool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosTwoToPosThree pool after first wager placement: ${betStateAfterFirstWager.posTwoToPosThreePool.toNumber()/LAMPORTS_PER_SOL}`);
    console.log(`Bet state PosThreeAndOver pool after first wager placement: ${betStateAfterFirstWager.posThreeAndOverPool.toNumber()/LAMPORTS_PER_SOL}`);
    
    console.log(`Bet State lamports after first wager placement: ${await program.provider.connection.getBalance(betStateKP.publicKey)/LAMPORTS_PER_SOL}`)

    ///// ***** CLOSING A BET STATE ***** /////

    const end_time = new anchor.BN(Date.now());

    const betStateBeforeClosing = await program.account.betState.fetch(betStateKP.publicKey);
    assert.ok(betStateBeforeClosing.status.hasOwnProperty("open"));

    await program.rpc.closeBetState(
      end_time,
      {
        accounts: {
          betState: betStateKP.publicKey,
          betCreator: providerWallet.publicKey
        }
      }
    )

    const betStateAfterClosing = await program.account.betState.fetch(betStateKP.publicKey);
    assert.ok(betStateAfterClosing);
    assert.ok(betStateAfterClosing.winningBetRange.hasOwnProperty("notAvailable"));
    assert.ok(betStateAfterClosing.status.hasOwnProperty("closed"));

    const bettor1Winnings = new anchor.BN(calculateWinnings(wagerDetails1Account, betStateAfterClosing));


    ///// ***** CLAIM WINNINGS ***** /////

    try {
      ///// ***** USER 1 CLAIMS WINNINGS ***** /////

      await program.rpc.claimWinnings(
        bettor1Winnings,
        {
          accounts: {
            betState: betStateKP.publicKey,
            wagerDetail: wagerDetail1KP.publicKey,
            userAccount: user1AccountKP.publicKey,
            bettor: user1KP.publicKey
          },
          signers:[user1KP]
        }
      )
    } catch (error) {
      assert.equal(error, 'Cannot carry out this action while the bet is still undecided on a winner.');
      return;
    }
    
  });


});
