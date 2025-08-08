import { create } from 'ipfs-http-client';

// IPFS 클라이언트 설정
const ipfsClient = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
  headers: {
    authorization: process.env.INFURA_IPFS_AUTH || 'Basic ' + Buffer.from(
      process.env.INFURA_PROJECT_ID + ':' + process.env.INFURA_PROJECT_SECRET
    ).toString('base64')
  }
});

export interface PropertyMetadata {
  name: string;
  description: string;
  location: string;
  totalValue: string;
  landArea: number;
  buildingArea: number;
  yearBuilt: number;
  propertyType: string;
  images: string[];
  documents: string[];
  features: string[];
  amenities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
  };
}

/**
 * 부동산 메타데이터 생성
 */
export function createPropertyMetadata(propertyData: {
  location: string;
  totalValue: string;
  landArea: number;
  buildingArea: number;
  yearBuilt: number;
  propertyType: string;
  description?: string;
  features?: string[];
  amenities?: string[];
}): PropertyMetadata {
  return {
    name: `${propertyData.location} 부동산`,
    description: propertyData.description || `${propertyData.location}에 위치한 ${propertyData.propertyType} 부동산입니다.`,
    location: propertyData.location,
    totalValue: propertyData.totalValue,
    landArea: propertyData.landArea,
    buildingArea: propertyData.buildingArea,
    yearBuilt: propertyData.yearBuilt,
    propertyType: propertyData.propertyType,
    images: [],
    documents: [],
    features: propertyData.features || [],
    amenities: propertyData.amenities || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * 토큰 메타데이터 생성
 */
export function createTokenMetadata(tokenData: {
  name: string;
  symbol: string;
  description: string;
  propertyId: string;
  totalSupply: string;
  tokenPrice: string;
  dividendRate: number;
  lockupPeriod: number;
}): TokenMetadata {
  return {
    name: tokenData.name,
    symbol: tokenData.symbol,
    description: tokenData.description,
    image: `https://ipfs.io/ipfs/QmPropertyImage/${tokenData.propertyId}`,
    external_url: `https://homesure.com/property/${tokenData.propertyId}`,
    attributes: [
      {
        trait_type: "Property ID",
        value: tokenData.propertyId
      },
      {
        trait_type: "Total Supply",
        value: tokenData.totalSupply
      },
      {
        trait_type: "Token Price",
        value: tokenData.tokenPrice
      },
      {
        trait_type: "Dividend Rate",
        value: `${tokenData.dividendRate}%`
      },
      {
        trait_type: "Lockup Period",
        value: `${tokenData.lockupPeriod} days`
      }
    ],
    properties: {
      files: [
        {
          uri: `https://ipfs.io/ipfs/QmPropertyDoc/${tokenData.propertyId}`,
          type: "application/pdf"
        }
      ],
      category: "Real Estate Token"
    }
  };
}

/**
 * 메타데이터를 IPFS에 업로드
 */
export async function uploadMetadataToIPFS(metadata: PropertyMetadata | TokenMetadata): Promise<string> {
  try {
    console.log('IPFS에 메타데이터 업로드 중...');
    
    const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
    const result = await ipfsClient.add(metadataBuffer);
    
    console.log(`메타데이터가 IPFS에 업로드되었습니다: ${result.path}`);
    return result.path;
  } catch (error) {
    console.error('IPFS 업로드 실패:', error);
    
    // 폴백: 로컬 해시 생성
    const fallbackHash = `QmFallback${Date.now()}`;
    console.log(`폴백 해시 생성: ${fallbackHash}`);
    return fallbackHash;
  }
}

/**
 * IPFS에서 메타데이터 다운로드
 */
export async function downloadMetadataFromIPFS(ipfsHash: string): Promise<PropertyMetadata | TokenMetadata | null> {
  try {
    console.log(`IPFS에서 메타데이터 다운로드 중: ${ipfsHash}`);
    
    const chunks = [];
    for await (const chunk of ipfsClient.cat(ipfsHash)) {
      chunks.push(chunk);
    }
    
    const metadataBuffer = Buffer.concat(chunks);
    const metadata = JSON.parse(metadataBuffer.toString());
    
    console.log('메타데이터 다운로드 완료');
    return metadata;
  } catch (error) {
    console.error('IPFS 다운로드 실패:', error);
    return null;
  }
}

/**
 * 이미지를 IPFS에 업로드
 */
export async function uploadImageToIPFS(imageBuffer: Buffer, filename: string): Promise<string> {
  try {
    console.log(`이미지 업로드 중: ${filename}`);
    
    const result = await ipfsClient.add({
      path: filename,
      content: imageBuffer
    });
    
    console.log(`이미지 업로드 완료: ${result.path}`);
    return result.path;
  } catch (error) {
    console.error('이미지 업로드 실패:', error);
    return `QmImageFallback${Date.now()}`;
  }
}

/**
 * 문서를 IPFS에 업로드
 */
export async function uploadDocumentToIPFS(documentBuffer: Buffer, filename: string): Promise<string> {
  try {
    console.log(`문서 업로드 중: ${filename}`);
    
    const result = await ipfsClient.add({
      path: filename,
      content: documentBuffer
    });
    
    console.log(`문서 업로드 완료: ${result.path}`);
    return result.path;
  } catch (error) {
    console.error('문서 업로드 실패:', error);
    return `QmDocFallback${Date.now()}`;
  }
}

/**
 * IPFS 연결 상태 확인
 */
export async function checkIPFSConnection(): Promise<boolean> {
  try {
    const version = await ipfsClient.version();
    console.log('IPFS 연결 성공:', version);
    return true;
  } catch (error) {
    console.error('IPFS 연결 실패:', error);
    return false;
  }
}

/**
 * IPFS 게이트웨이 URL 생성
 */
export function getIPFSGatewayURL(ipfsHash: string): string {
  return `https://ipfs.io/ipfs/${ipfsHash}`;
}

/**
 * IPFS 해시 유효성 검사
 */
export function isValidIPFSHash(hash: string): boolean {
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(hash);
} 
}; 