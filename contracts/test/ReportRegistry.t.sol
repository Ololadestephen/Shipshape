// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../ReportRegistry.sol";

contract PublisherClient {
    ReportRegistry public registry;

    constructor(ReportRegistry _registry) {
        registry = _registry;
    }

    function publish(bytes32 reportHash, bytes32 predecessorHash, uint256 version, string memory ref) external {
        registry.publishReport(reportHash, predecessorHash, version, ref);
    }
}

contract ReportRegistryTest {
    ReportRegistry public registry;
    PublisherClient public clientA;
    PublisherClient public clientB;

    bytes32 internal hash1 = keccak256(abi.encodePacked("report-1"));
    bytes32 internal hash2 = keccak256(abi.encodePacked("report-2"));
    bytes32 internal hash3 = keccak256(abi.encodePacked("report-3"));

    function setUp() public {
        registry = new ReportRegistry();
        clientA = new PublisherClient(registry);
        clientB = new PublisherClient(registry);
    }

    function test_InitialPublication() public {
        clientA.publish(hash1, bytes32(0), 1, "prj_123");

        ReportRegistry.ReportRecord memory rec = registry.getReport(hash1);
        assert(rec.publisher == address(clientA));
        assert(rec.reportHash == hash1);
        assert(rec.predecessorHash == bytes32(0));
        assert(rec.version == 1);
        assert(rec.publishedAt > 0);
        assert(registry.isReportPublished(hash1));
        assert(registry.getLatestReportByReference("prj_123") == hash1);

        bytes32[] memory listA = registry.getPublisherReports(address(clientA));
        assert(listA.length == 1);
        assert(listA[0] == hash1);
    }

    function test_RevertEmptyReportHash() public {
        try clientA.publish(bytes32(0), bytes32(0), 1, "prj_123") {
            assert(false);
        } catch {
            // expected revert
        }
    }

    function test_RevertDuplicateSubmission() public {
        clientA.publish(hash1, bytes32(0), 1, "prj_123");

        try clientA.publish(hash1, bytes32(0), 1, "prj_123") {
            assert(false);
        } catch {
            // expected duplicate revert
        }
    }

    function test_VersionProgression() public {
        clientA.publish(hash1, bytes32(0), 1, "prj_123");
        clientA.publish(hash2, hash1, 2, "prj_123");

        ReportRegistry.ReportRecord memory rec2 = registry.getReport(hash2);
        assert(rec2.publisher == address(clientA));
        assert(rec2.version == 2);
        assert(rec2.predecessorHash == hash1);
        assert(registry.getLatestReportByReference("prj_123") == hash2);

        bytes32[] memory listA = registry.getPublisherReports(address(clientA));
        assert(listA.length == 2);
        assert(listA[1] == hash2);
    }

    function test_RevertPredecessorPublisherMismatch() public {
        // Client A publishes v1
        clientA.publish(hash1, bytes32(0), 1, "prj_123");

        // Client B tries to publish v2 on top of Client A's report -> MUST REVERT
        try clientB.publish(hash2, hash1, 2, "prj_123") {
            assert(false);
        } catch {
            // expected mismatch revert
        }
    }

    function test_RevertInvalidVersionZero() public {
        try clientA.publish(hash1, bytes32(0), 0, "prj_123") {
            assert(false);
        } catch {
            // expected revert
        }
    }

    function test_RevertVersionSkip() public {
        clientA.publish(hash1, bytes32(0), 1, "prj_123");

        // Try to jump from v1 to v3 directly -> MUST REVERT
        try clientA.publish(hash2, hash1, 3, "prj_123") {
            assert(false);
        } catch {
            // expected revert
        }
    }

    function test_RevertPredecessorNotFound() public {
        try clientA.publish(hash2, hash1, 2, "prj_123") {
            assert(false);
        } catch {
            // expected revert because hash1 not yet published
        }
    }

    function test_RevertReferenceTooLong() public {
        // Create string > 256 bytes
        bytes memory longRef = new bytes(257);
        for (uint256 i = 0; i < 257; i++) {
            longRef[i] = "x";
        }

        try clientA.publish(hash1, bytes32(0), 1, string(longRef)) {
            assert(false);
        } catch {
            // expected revert
        }
    }
}
