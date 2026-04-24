import { handleMS } from "./handlers/handleMS";
import { handleCT } from "./handlers/handleCT";
import { handleMC } from "./handlers/handleMC";
import { handleRMC } from "./handlers/handleRMC";
import { handleFL } from "./handlers/handleFL";
import { handleLE } from "./handlers/handleLE";
import { handleEM } from "./handlers/handleEM";
import { handleEI } from "./handlers/handleEI";
import { handleSC } from "./handlers/handleSC";
import { handleCI } from "./handlers/handleCI";
import { handleFM } from "./handlers/handleFM";
import { handleFA } from "./handlers/handleFA";
import { handleSM } from "./handlers/handleSM";
import { handleMM } from "./handlers/handleMM";
import { handleBD } from "./handlers/handleBD";
import { handleBB } from "./handlers/handleBB";
import { handleKB } from "./handlers/handleKB";
import { handleKK } from "./handlers/handleKK";
import { handleDONE } from "./handlers/handleDONE";
import { handleBN } from "./handlers/handleBN";
import { handleHP } from "./handlers/handleHP";
import { handleRT } from "./handlers/handleRT";
import { handleTI } from "./handlers/handleTI";
import { handleZZ } from "./handlers/handleZZ";
import { handleHI } from "./handlers/handleHI";
import { handleID } from "./handlers/handleID";
import { handlePN } from "./handlers/handlePN";
import { handleSI } from "./handlers/handleSI";
import { handleARUP } from "./handlers/handleARUP";
import { handleAUTH } from "./handlers/handleAUTH";
import { handleaskchaa } from "./handlers/handleaskchaa";
import { handleCC } from "./handlers/handleCC";
import { handleRC } from "./handlers/handleRC";
import { handleRM } from "./handlers/handleRM";
import { handleRD } from "./handlers/handleRD";
import { handleCharsCheck } from "./handlers/handleCharsCheck";
import { handlePV } from "./handlers/handlePV";
import { handleASS } from "./handlers/handleASS";
import { handleackMS } from "./handlers/handleackMS";
import { handleSP } from "./handlers/handleSP";
import { handleJD } from "./handlers/handleJD";
import { handlePU } from "./handlers/handlePU";
import { handlePR } from "./handlers/handlePR";
import { handleVC_CAPS } from "./handlers/handleVC_CAPS";
import { handleVC_JOIN } from "./handlers/handleVC_JOIN";
import { handleVC_LEAVE } from "./handlers/handleVC_LEAVE";
import { handleVC_PEERS } from "./handlers/handleVC_PEERS";
import { handleVC_SIG } from "./handlers/handleVC_SIG";
import { handleVC_SPEAK } from "./handlers/handleVC_SPEAK";

export const packets = {
  MS: handleMS,
  CT: handleCT,
  MC: handleMC,
  RMC: handleRMC,
  CI: handleCI,
  SC: handleSC,
  EI: handleEI,
  FL: handleFL,
  LE: handleLE,
  EM: handleEM,
  FM: handleFM,
  FA: handleFA,
  SM: handleSM,
  MM: handleMM,
  BD: handleBD,
  BB: handleBB,
  KB: handleKB,
  KK: handleKK,
  DONE: handleDONE,
  BN: handleBN,
  HP: handleHP,
  RT: handleRT,
  TI: handleTI,
  ZZ: handleZZ,
  HI: handleHI,
  ID: handleID,
  PN: handlePN,
  SI: handleSI,
  ARUP: handleARUP,
  AUTH: handleAUTH,
  askchaa: handleaskchaa,
  CC: handleCC,
  RC: handleRC,
  RM: handleRM,
  RD: handleRD,
  CharsCheck: handleCharsCheck,
  PV: handlePV,
  ASS: handleASS,
  ackMS: handleackMS,
  SP: handleSP,
  JD: handleJD,
  PU: handlePU,
  PR: handlePR,
  VC_CAPS: handleVC_CAPS,
  VC_JOIN: handleVC_JOIN,
  VC_LEAVE: handleVC_LEAVE,
  VC_PEERS: handleVC_PEERS,
  VC_SIG: handleVC_SIG,
  VC_SPEAK: handleVC_SPEAK,
  decryptor: () => {},
  CHECK: () => {},
  CH: () => {},
};
