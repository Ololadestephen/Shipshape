// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ReportRegistry
 * @notice Immutable registry for software release-readiness report snapshots on BOT Chain.
 */
contract ReportRegistry {
    struct ReportRecord {
        address publisher;
        bytes32 reportHash;
        bytes32 predecessorHash;
        uint256 version;
        uint256 publishedAt;
        string reportReference;
    }

    mapping(bytes32 => ReportRecord) private _reports;
    mapping(address => bytes32[]) private _publisherReports;
    mapping(string => bytes32) private _referenceLatest;

    event ReportPublished(
        address indexed publisher,
        bytes32 indexed reportHash,
        bytes32 indexed predecessorHash,
        uint256 version,
        uint256 publishedAt,
        string reportReference
    );

    error EmptyReportHash();
    error ReportAlreadyExists(bytes32 reportHash);
    error InvalidVersion();
    error PredecessorNotFound(bytes32 predecessorHash);
    error PredecessorPublisherMismatch(address expected, address actual);
    error ReferenceTooLong();

    uint256 public constant MAX_REFERENCE_LENGTH = 256;

    /**
     * @notice Publishes an immutable report snapshot fingerprint.
     * @param reportHash The 32-byte hash of the canonical report snapshot.
     * @param predecessorHash The 32-byte hash of the prior version (bytes32(0) for v1).
     * @param version The sequential version number (1 for initial).
     * @param reportReference Bounded public reference (e.g. project id or share handle).
     */
    function publishReport(
        bytes32 reportHash,
        bytes32 predecessorHash,
        uint256 version,
        string calldata reportReference
    ) external {
        if (reportHash == bytes32(0)) {
            revert EmptyReportHash();
        }
        if (_reports[reportHash].publishedAt != 0) {
            revert ReportAlreadyExists(reportHash);
        }
        if (bytes(reportReference).length > MAX_REFERENCE_LENGTH) {
            revert ReferenceTooLong();
        }

        if (version == 0) {
            revert InvalidVersion();
        }

        if (version == 1) {
            if (predecessorHash != bytes32(0)) {
                revert InvalidVersion();
            }
        } else {
            if (predecessorHash == bytes32(0)) {
                revert PredecessorNotFound(predecessorHash);
            }
            ReportRecord storage pred = _reports[predecessorHash];
            if (pred.publishedAt == 0) {
                revert PredecessorNotFound(predecessorHash);
            }
            if (pred.publisher != msg.sender) {
                revert PredecessorPublisherMismatch(pred.publisher, msg.sender);
            }
            if (version != pred.version + 1) {
                revert InvalidVersion();
            }
        }

        ReportRecord memory record = ReportRecord({
            publisher: msg.sender,
            reportHash: reportHash,
            predecessorHash: predecessorHash,
            version: version,
            publishedAt: block.timestamp,
            reportReference: reportReference
        });

        _reports[reportHash] = record;
        _publisherReports[msg.sender].push(reportHash);

        if (bytes(reportReference).length > 0) {
            _referenceLatest[reportReference] = reportHash;
        }

        emit ReportPublished(
            msg.sender,
            reportHash,
            predecessorHash,
            version,
            block.timestamp,
            reportReference
        );
    }

    /**
     * @notice Fetches the publication record for a given report hash.
     */
    function getReport(bytes32 reportHash) external view returns (ReportRecord memory) {
        return _reports[reportHash];
    }

    /**
     * @notice Returns true if a report hash has been recorded.
     */
    function isReportPublished(bytes32 reportHash) external view returns (bool) {
        return _reports[reportHash].publishedAt != 0;
    }

    /**
     * @notice Returns all report hashes published by an address.
     */
    function getPublisherReports(address publisher) external view returns (bytes32[] memory) {
        return _publisherReports[publisher];
    }

    /**
     * @notice Returns the latest report hash for a reference string.
     */
    function getLatestReportByReference(string calldata reportRef) external view returns (bytes32) {
        return _referenceLatest[reportRef];
    }
}

/**
 * @title ShipBotRegistry
 * @notice Final brand contract for ShipBot on BOT Chain.
 */
contract ShipBotRegistry is ReportRegistry {}

